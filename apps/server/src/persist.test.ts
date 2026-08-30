import { afterAll, describe, expect, it } from 'vitest';
import { canPass, legalMoves, type Action } from '@thirteen/engine';
import type { ServerMessage } from '@thirteen/protocol';
import { Room } from './room.js';
import { closeDb, countGames, loadRoomState } from './db.js';

/**
 * Persistence round-trip against a real Postgres (DATABASE_URL from the env).
 * Verifies the user-facing contract: hitting refresh — or a full server
 * restart — resumes the same game instead of losing it. Real timers: the
 * Postgres driver is timer-sensitive and bot delays here are single-digit ms.
 */

class FakeConn {
	sent: ServerMessage[] = [];
	private seqCounter = 0;
	send = (msg: ServerMessage) => {
		this.sent.push(msg);
	};
	nextSeq(): number {
		return ++this.seqCounter;
	}
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function legalAction(state: NonNullable<Room['state']>, turn: number): Action {
	return canPass(state, turn)
		? [...legalMoves(state, turn), { type: 'pass', cards: [] }][0]!
		: legalMoves(state, turn)[0]!;
}

describe.skipIf(!process.env.DATABASE_URL)('room persistence (postgres)', () => {
	afterAll(async () => {
		await closeDb();
	});

	it('persists a live game and resumes it after a full restart', async () => {
		const room = new Room({ code: 'PERSIST', password: 'pw', seed: 42, botDelayMs: 5 });
		const host = new FakeConn();
		room.join('Ann', 'sid-a', host);

		// Guest takes seat 1 BEFORE the host starts (start fills only empty seats).
		const guest = new FakeConn();
		expect(room.join('Ben', 'sid-b', guest, 'pw')).toBe(1);
		room.start(host);
		for (let i = 0; i < 100 && room.state?.turn === -1; i++) await wait(10);
		expect(room.state).not.toBeNull();
		expect(room.state!.turn).toBeGreaterThanOrEqual(0);

		// Everything durable is on disk now (join + start + bot moves persist).
		await wait(150);
		const saved = await loadRoomState('PERSIST');
		expect(saved).not.toBeNull();
		expect(saved!.state).toMatchObject({ handNumber: 0 });
		expect(saved!.seats.map((s) => s.sid)).toContain('sid-b');

		// "Server restart": fresh Room instance restored from the DB row.
		const restored = await Room.restore('PERSIST');
		expect(restored).not.toBeNull();
		expect(restored!.state).toStrictEqual(room.state);

		// The guest's sid reclaims the seat on the restored room — refresh works.
		const seat = restored!.join('Ben', 'sid-b', guest);
		expect(seat).toBe(1);
		const stateMsg = guest.sent.filter((m) => m.t === 'state').at(-1);
		expect(stateMsg).toMatchObject({ t: 'state', seat: 1 });
	}, 20_000);

	it('stores hashed lobby passwords and records completed games', async () => {
		const room = new Room({ code: 'DONE', password: 'pw', seed: 7, botDelayMs: 5 });
		const host = new FakeConn();
		room.join('Ann', 'sid-c', host);
		room.start(host);
		const seats: FakeConn[] = [host];
		for (let s = 1; s < 4; s++) {
			const c = new FakeConn();
			room.join(`P${s}`, `sid-p${s}`, c, 'pw');
			seats.push(c);
		}
		await wait(100);
		const saved = await loadRoomState('DONE');
		expect(saved!.passwordHash).toMatch(/^[0-9a-f]{64}$/);

		// Drive the whole game to completion with the engine's own legal moves.
		for (let i = 0; i < 800 && room.state && room.state.phase === 'playing'; i++) {
			const turn = room.state.turn;
			if (turn === -1) break;
			if (room.seatIsBot(turn)) {
				await wait(8);
				continue;
			}
			const st = room.state;
			room.action(seats[turn]!, seats[turn]!.nextSeq(), legalAction(st, turn));
			await wait(8);
		}
		await wait(150);
		if (room.state?.phase === 'gameOver') {
			expect(await countGames('DONE')).toBeGreaterThanOrEqual(1);
		}
	}, 40_000);
});

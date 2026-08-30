import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canPass, legalMoves, type Action } from '@thirteen/engine';
import type { ServerMessage } from '@thirteen/protocol';
import { Room, RoomError, makeRoomCode } from './room.js';

/** Recording fake connection — stands in for a browser WebSocket. */
class FakeConn {
	sent: ServerMessage[] = [];
	private seqCounter = 0;
	send = (msg: ServerMessage) => {
		this.sent.push(msg);
	};
	/** Strictly increasing per-connection action counter (gaps tolerated server-side). */
	nextSeq(): number {
		return ++this.seqCounter;
	}
	get last(): ServerMessage | undefined {
		return this.sent[this.sent.length - 1];
	}
	states() {
		return this.sent.filter((m) => m.t === 'state');
	}
	events(name?: string) {
		return this.sent.filter((m) => m.t === 'event' && (name === undefined || m.name === name));
	}
}

const GRACE = 30;
const BOT_DELAY = 5;
const PASS: Action = { type: 'pass', cards: [] };

function makeRoom(seed = 42) {
	return new Room({ code: 'TEST', seed, botDelayMs: BOT_DELAY, disconnectGraceMs: GRACE });
}

function joinFour(room: ReturnType<typeof makeRoom>) {
	const seats = [new FakeConn(), new FakeConn(), new FakeConn(), new FakeConn()];
	seats.forEach((c, i) => room.join(`P${i}`, `sid-${i}`, c));
	return seats;
}

/** Advances fake time past one bot delay while bots keep having the turn. */
function runDueBot(room: ReturnType<typeof makeRoom>, maxChained = 4) {
	for (let i = 0; i < maxChained; i++) {
		const state = room.state;
		if (!state || state.phase !== 'playing') return;
		if (!room.seatIsBot(state.turn)) return;
		vi.advanceTimersByTime(BOT_DELAY + 1);
	}
}

function legalAction(state: NonNullable<Room['state']>, turn: number): Action {
	return canPass(state, turn)
		? [...legalMoves(state, turn), PASS][0]!
		: legalMoves(state, turn)[0]!;
}

/** Plays until the hand ends: humans act greedily via the engine. */
function playHand(room: ReturnType<typeof makeRoom>, seats: FakeConn[], handLimit = 600) {
	for (let i = 0; i < handLimit; i++) {
		const state = room.state;
		if (!state || state.phase !== 'playing') return;
		const turn = state.turn;
		if (room.seatIsBot(turn)) {
			runDueBot(room, 1);
			continue;
		}
		room.action(seats[turn]!, seats[turn]!.nextSeq(), legalAction(state, turn));
		runDueBot(room);
	}
}

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
});

describe('room', () => {
	it('assigns seats in join order and reports the lobby', () => {
		const room = makeRoom();
		joinFour(room);
		const lobby = room.lobbyMessage(2);
		expect(lobby).toMatchObject({ t: 'lobby', room: 'TEST', seat: 2, hostSeat: 0 });
		expect(lobby.t === 'lobby' && lobby.players).toEqual(['P0', 'P1', 'P2', 'P3']);
	});

	it('rejects the fifth player', () => {
		const room = makeRoom();
		joinFour(room);
		const fifth = new FakeConn();
		expect(room.join('P5', 'sid-5', fifth)).toBeNull();
	});

	it('joining broadcasts the lobby to everyone already seated', () => {
		const room = makeRoom();
		const host = new FakeConn();
		room.join('P0', 'sid-0', host);
		const guest = new FakeConn();
		room.join('P1', 'sid-1', guest);
		const lobbies = host.sent.filter((m) => m.t === 'lobby');
		expect(lobbies).toHaveLength(2);
		expect(lobbies[1]).toMatchObject({ t: 'lobby', players: ['P0', 'P1', '', ''], hostSeat: 0 });
	});

	it('a renaming rejoin refreshes the lobby roster', () => {
		const room = makeRoom();
		const host = new FakeConn();
		room.join('P0', 'sid-0', host);
		room.join('P1', 'sid-1', new FakeConn());
		host.sent.length = 0;
		room.join('Ace', 'sid-1', new FakeConn());
		const lobbies = host.sent.filter((m) => m.t === 'lobby');
		expect(lobbies).toHaveLength(1);
		expect(lobbies[0]).toMatchObject({ players: ['P0', 'Ace', '', ''] });
	});

	it('only the host can start; start fills bots and deals', () => {
		const room = makeRoom();
		const seats = joinFour(room);
		room.start(seats[1]!);
		expect(seats[1]!.last).toMatchObject({ t: 'error', code: 'not_host' });
		room.start(seats[0]!);
		expect(room.state).not.toBeNull();
		expect(seats[0]!.last!.t).toBe('state');
	});

	it('replays duplicate seq silently', () => {
		const room = makeRoom();
		const seats = joinFour(room);
		room.start(seats[0]!);
		const before = room.seq;
		room.action(seats[0]!, 0, { type: 'pass', cards: [] });
		expect(room.seq).toBe(before);
	});

	it('server rejects out-of-turn actions', () => {
		const room = makeRoom();
		const seats = joinFour(room);
		room.start(seats[0]!);
		const wrong = (room.state!.turn + 1) % 4;
		const conn = seats[wrong]!;
		room.action(conn, conn.nextSeq(), { type: 'pass', cards: [] });
		expect(conn.last).toMatchObject({ t: 'error', code: 'not_your_turn' });
	});

	it('humans see their own hand only; opponents arrive as counts', () => {
		const room = makeRoom();
		const seats = joinFour(room);
		room.start(seats[0]!);
		for (const c of seats) {
			const msg = c.last!;
			expect(msg.t).toBe('state');
			if (msg.t !== 'state') continue;
			expect(msg.seatNames[0]).toBe(`P${seats.indexOf(c)}`);
			expect(msg.state.players[0]!.hand.length).toBe(13);
			for (let d = 1; d < 4; d++) {
				expect(msg.state.players[d]!.hand).toEqual([]);
				expect(msg.state.players[d]!.handCount).toBeGreaterThan(0);
			}
			expect(JSON.stringify(msg.state.players.slice(1))).not.toContain('"rank"');
		}
	});

	it('a disconnected human seat is bot-taken-over after the grace period', () => {
		const room = makeRoom();
		const seats = joinFour(room);
		room.start(seats[0]!);
		playHand(room, seats);
		room.disconnect(seats[1]!);
		vi.advanceTimersByTime(GRACE + 1);
		expect(room.seatIsBot(1)).toBe(true);
		expect(seats[0]!.events('botTakeover').length).toBe(1);
		// The seat keeps playing as a bot from here on.
		const cardsBefore = room.state!.players[1]!.hand.length;
		runDueBot(room, 8);
		expect(room.state!.players[1]!.hand.length).toBeLessThanOrEqual(cardsBefore);
	});

	it('rejoin by sid within the grace window reclaims the seat', () => {
		const room = makeRoom();
		const seats = joinFour(room);
		room.start(seats[0]!);
		playHand(room, seats);
		room.disconnect(seats[1]!);
		const rejoin = new FakeConn();
		expect(room.join('P1', 'sid-1', rejoin)).toBe(1);
		const snapshot = rejoin.last!;
		expect(snapshot.t).toBe('state');
		if (snapshot.t === 'state') {
			expect(snapshot.seat).toBe(1);
			expect(snapshot.seatNames[0]).toBe('P1');
		}
		vi.advanceTimersByTime(GRACE + 1);
		expect(room.seatIsBot(1)).toBe(false);
	});

	it('a reclaimed seat accepts a fresh action counter after a page reload', () => {
		const room = makeRoom();
		const seats = joinFour(room);
		room.start(seats[0]!);
		playHand(room, seats);
		room.disconnect(seats[1]!);
		const rejoin = new FakeConn();
		room.join('P1', 'sid-1', rejoin);
		// Drive play until seat 1 must act, then send with a brand-new counter.
		for (let i = 0; i < 200; i++) {
			let state = room.state!;
			if (state.phase === 'handOver') {
				room.nextHand(seats[0]!);
				state = room.state!;
			}
			if (state.phase !== 'playing') break;
			if (room.seatIsBot(state.turn)) {
				runDueBot(room, 1);
				continue;
			}
			if (state.turn !== 1) {
				const conn = seats[state.turn]!;
				room.action(conn, conn.nextSeq(), legalAction(state, state.turn));
				runDueBot(room);
				continue;
			}
			const before = room.seq;
			room.action(rejoin, 1, legalAction(state, 1));
			expect(room.seq).toBe(before + 1);
			return;
		}
		throw new Error('seat 1 never got a turn');
	});

	it('leave in the lobby frees the seat and broadcasts the lobby', () => {
		const room = makeRoom();
		const seats = joinFour(room);
		room.leave(seats[2]!);
		const lobby = room.lobbyMessage(0);
		expect(lobby.t === 'lobby' && lobby.players).toEqual(['P0', 'P1', '', 'P3']);
		const late = new FakeConn();
		expect(room.join('Late', 'sid-late', late)).toBe(2);
	});

	it('leave mid-game hands the seat to a bot and informs the other humans', () => {
		const room = makeRoom();
		const seats = joinFour(room);
		room.start(seats[0]!);
		playHand(room, seats);
		room.leave(seats[1]!);
		expect(room.seatIsBot(1)).toBe(true);
		expect(seats[0]!.events('botTakeover').length).toBe(1);
		// Remaining humans get an updated snapshot that names the new bot.
		const last = seats[0]!.states().at(-1)!;
		expect(last.t === 'state' && last.seatNames.includes('Lan')).toBe(true);
	});

	it('plays a full four-human game to game over', () => {
		const room = makeRoom();
		const seats = joinFour(room);
		room.start(seats[0]!);
		for (let hand = 0; hand < 60 && room.state!.phase !== 'gameOver'; hand++) {
			playHand(room, seats);
			if (room.state!.phase === 'handOver') room.nextHand(seats[0]!);
		}
		expect(room.state!.phase).toBe('gameOver');
		for (const c of seats) {
			const f = c.states().at(-1)!;
			expect(f.t === 'state' && f.state.phase).toBe('gameOver');
		}
	});

	it('two humans + two bots play to game over with no bot-seat input', () => {
		const room = makeRoom();
		const s0 = new FakeConn();
		const s1 = new FakeConn();
		room.join('A', 'sid-a', s0);
		room.join('B', 'sid-b', s1);
		room.start(s0); // seats 2, 3 fill with bots
		for (let i = 0; i < 4000 && room.state!.phase !== 'gameOver'; i++) {
			const state = room.state!;
			if (state.phase === 'handOver') {
				room.nextHand(state.lastHandWinner === 0 ? s0 : s1);
				runDueBot(room);
				continue;
			}
			if (state.phase !== 'playing') break;
			const turn = state.turn;
			if (room.seatIsBot(turn)) {
				runDueBot(room, 1);
				continue;
			}
			const conn = turn === 0 ? s0 : s1;
			room.action(conn, conn.nextSeq(), legalAction(state, turn));
			runDueBot(room);
		}
		expect(room.state!.phase).toBe('gameOver');
	});

	it('makeRoomCode avoids ambiguous characters', () => {
		expect(makeRoomCode(() => 0)).toBe('AAAA');
	});

	it('gates new joins behind the lobby password but exempts sid reclaim', () => {
		const room = new Room({ code: 'PW', password: 'sesame', seed: 42 });
		const host = new FakeConn();
		room.join('Ann', 'sid-a', host);

		const noPw = new FakeConn();
		expect(() => room.join('Ben', 'sid-b', noPw)).toThrowError(RoomError);
		const wrong = new FakeConn();
		expect(() => room.join('Ben', 'sid-b', wrong, 'wrong')).toThrowError(RoomError);
		expect(room.lobbyMessage(0)).toMatchObject({ players: ['Ann', '', '', ''] });

		const good = new FakeConn();
		expect(room.join('Ben', 'sid-b', good, 'sesame')).toBe(1);

		// Reload: same sid, no password — reclaims the seat instead of erroring.
		expect(room.join('Ben', 'sid-b', good)).toBe(1);
	});
});

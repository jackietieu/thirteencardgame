import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { startServer, type ServerHandle } from './index.js';
import type { ClientMessage, ServerMessage } from '@thirteen/protocol';

/**
 * Integration test: a real server with real sockets. Waits are bounded
 * condition polls, never fixed sleeps.
 */
class WsClient {
	ws: WebSocket;
	inbox: ServerMessage[] = [];
	private seqCounter = 0;

	constructor(port: number) {
		this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
		this.ws.on('message', (raw) => {
			this.inbox.push(JSON.parse(String(raw)) as ServerMessage);
		});
	}

	send(msg: ClientMessage) {
		this.ws.send(JSON.stringify(msg));
	}

	nextSeq(): number {
		return ++this.seqCounter;
	}

	opened(): Promise<void> {
		const { promise, resolve, reject } = Promise.withResolvers<void>();
		this.ws.once('open', () => resolve());
		this.ws.once('error', reject);
		return promise;
	}

	async waitFor(pred: (m: ServerMessage) => boolean, timeoutMs = 5000): Promise<ServerMessage> {
		const { promise, resolve, reject } = Promise.withResolvers<ServerMessage>();
		const deadline = Date.now() + timeoutMs;
		const poll = () => {
			const found = this.inbox.find(pred);
			if (found) return resolve(found);
			if (Date.now() > deadline) return reject(new Error('waitFor timeout'));
			setTimeout(poll, 10);
		};
		poll();
		return promise;
	}

	close() {
		this.ws.close();
	}
}

let server: ServerHandle;

// Hermetic: never call the real OpenAI moderations API even when a key is
// present in the developer's environment.
process.env.OPENAI_MODERATION = 'off';

beforeEach(async () => {
	server = await startServer({ port: 0 });
});

describe('ws server', () => {
	it('health endpoint responds', async () => {
		const res = await fetch(`http://127.0.0.1:${server.port}/`);
		const body = (await res.json()) as { ok: boolean };
		expect(body.ok).toBe(true);
	});

	it('create → lobby → start with bots → state arrives', async () => {
		const host = new WsClient(server.port);

		await host.opened();
		host.send({ t: 'create', sid: 'sid-a', name: 'Alice' });
		const lobby = await host.waitFor((m) => m.t === 'lobby');
		expect(lobby.t === 'lobby' && lobby.seat).toBe(0);
		host.send({ t: 'start' });
		const state = await host.waitFor((m) => m.t === 'state');
		expect(state.t === 'state' && state.seatNames[0]).toBe('Alice');
		expect(state.t === 'state' && state.state.players[0]!.hand.length).toBe(13);
		host.close();
	});

	it('answers pings with pongs', async () => {
		const c = new WsClient(server.port);
		await c.opened();
		c.send({ t: 'create', sid: 'sid-p', name: 'Pat' });
		await c.waitFor((m) => m.t === 'lobby');
		c.send({ t: 'ping' });
		const pong = await c.waitFor((m) => m.t === 'pong');
		expect(pong.t).toBe('pong');
		c.close();
	});

	it('two humans + two bots: both humans receive correctly rotated views', async () => {
		const a = new WsClient(server.port);
		const b = new WsClient(server.port);
		await Promise.all([a.opened(), b.opened()]);
		a.send({ t: 'create', sid: 'sid-a', name: 'Ann' });
		const lobby = await a.waitFor((m) => m.t === 'lobby');
		const room = lobby.t === 'lobby' ? lobby.room : '';
		b.send({ t: 'join', room, sid: 'sid-b', name: 'Ben' });
		await b.waitFor((m) => m.t === 'lobby');
		// The host must see the roster update — the reported join-visibility bug.
		const lobby2 = await a.waitFor((m) => m.t === 'lobby' && m.players[1] === 'Ben');
		expect(lobby2.t === 'lobby' && lobby2.players).toEqual(['Ann', 'Ben', '', '']);
		a.send({ t: 'start' });
		const sa = await a.waitFor((m) => m.t === 'state');
		const sb = await b.waitFor((m) => m.t === 'state');
		expect(sa.t === 'state' && sa.seatNames[0]).toBe('Ann');
		expect(sb.t === 'state' && sb.seatNames[0]).toBe('Ben');
		expect(sa.t === 'state' && sa.state.players[0]!.hand.length).toBe(13);
		expect(sb.t === 'state' && sb.state.players[0]!.hand.length).toBe(13);
		// Opponents hidden in both views.
		expect(sb.t === 'state' && sb.state.players[1]!.hand).toEqual([]);
		a.close();
		b.close();
	});

	it('chat flows between humans and replays to a reconnecting socket', async () => {
		const a = new WsClient(server.port);
		const b = new WsClient(server.port);
		await Promise.all([a.opened(), b.opened()]);
		a.send({ t: 'create', sid: 'sid-a', name: 'Ann' });
		const lobby = await a.waitFor((m) => m.t === 'lobby');
		const room = lobby.t === 'lobby' ? lobby.room : '';
		b.send({ t: 'join', room, sid: 'sid-b', name: 'Ben' });
		await b.waitFor((m) => m.t === 'lobby');
		a.send({ t: 'chat', text: 'hello Ben' });
		const got = await b.waitFor((m) => m.t === 'chat');
		expect(got.t === 'chat' && got.name).toBe('Ann');
		// Ben reloads: fresh socket, same sid — history replays.
		const b2 = new WsClient(server.port);
		await b2.opened();
		b2.send({ t: 'join', room, sid: 'sid-b', name: 'Ben' });
		const replay = await b2.waitFor((m) => m.t === 'chat');
		expect(replay.t === 'chat' && replay.text).toBe('hello Ben');
		a.close();
		b.close();
		b2.close();
	});

	it('closes the socket on an oversized frame (maxPayload)', async () => {
		const client = new WsClient(server.port);
		await client.opened();
		const closed = new Promise<{ code: number }>((resolve) => {
			// The server tears down mid-write, so the client socket may also
			// surface a write error — consume it; the close code is the assertion.
			client.ws.on('error', () => {});
			client.ws.once('close', (code: number) => resolve({ code }));
		});
		client.ws.send('x'.repeat(8192));
		const close = await closed;
		expect(close.code).toBe(1009);
	});

	it('rate-limits and closes flooding sockets', async () => {
		const client = new WsClient(server.port);
		await client.opened();
		const limited = client.waitFor((m) => m.t === 'error' && m.code === 'rate_limited');
		// Burst is 40; the server closes mid-flood, so later sends may fail locally.
		try {
			for (let i = 0; i < 80; i++) client.send({ t: 'nextHand' });
		} catch {
			// expected once the server has closed the socket
		}
		await limited;
	});

	it('rejects create when the server is at maxRooms', async () => {
		const full = await startServer({ port: 0, maxRooms: 0 });
		try {
			const client = new WsClient(full.port);
			await client.opened();
			client.send({ t: 'create', sid: 'sid', name: 'p' });
			await client.waitFor((m) => m.t === 'error' && m.code === 'server_full');
			client.close();
		} finally {
			await full.close();
		}
	});
});

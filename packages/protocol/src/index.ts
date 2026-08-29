import type { Action, GameState } from '@thirteen/engine';

/**
 * Wire protocol between the game server and browser clients (JSON over WS).
 * One envelope per frame, discriminated on `t`.
 *
 * Every `state` message carries a *seat view* already rotated for the
 * recipient: the recipient is display seat 0, opponents' hands are replaced
 * by `handCount`, and `seq` is the room's global action counter.
 */
export interface SeatView extends GameState {
	/** Count of cards for seats whose `hand` is hidden (empty array in the view). */
	players: (GameState['players'][number] & { handCount: number })[];
}


export interface ClientCreate {
	t: 'create';
	sid: string;
	name: string;
}

export interface ClientStart {
	t: 'start';
}

export interface ClientJoin {
	t: 'join';
	room: string;
	sid: string;
	name: string;
}

export interface ClientAction {
	t: 'action';
	/** Per-client action counter, strictly increasing; server drops replays. */
	seq: number;
	action: Action;
}

export interface ClientNextHand {
	t: 'nextHand';
}

export interface ClientLeave {
	t: 'leave';
}

export type ClientMessage =
	| ClientCreate
	| ClientJoin
	| ClientStart
	| ClientAction
	| ClientNextHand
	| ClientLeave;

/** Full snapshot for one seat (or a lobby). */
export interface ServerLobby {
	t: 'lobby';
	room: string;
	/** Seat-ordered display names; empty string = empty seat. */
	players: string[];
	/** Whether each seat is a server-driven bot. */
	bots: boolean[];
	/** Your seat, or -1 if still unassigned. */
	seat: number;
	/** Seat of the room host (who may start the game). */
	hostSeat: number;
	phase: 'lobby';
}

export interface ServerState {
	t: 'state';
	/** Global room action counter — order/reconnect token. */
	seq: number;
	/** Your seat in room coordinates. */
	seat: number;
	/** Seat-ordered display names, rotated so you are index 0. */
	seatNames: string[];
	state: SeatView;
}

/** One play/pass, already rotated for the recipient — for the log/animations. */
export interface ServerEvent {
	t: 'event';
	name: 'played' | 'passed' | 'nextHand' | 'seatLeft' | 'botTakeover';
	/** Display seat (recipient = 0) the event concerns, or -1 if none. */
	seat: number;
	handNumber: number;
	action?: Action;
}

export interface ServerError {
	t: 'error';
	code: string;
	/** The client `seq` this error concerns, or -1. */
	on: number;
}

export interface ServerPong {
	t: 'pong';
}

export type ServerMessage = ServerLobby | ServerState | ServerEvent | ServerError | ServerPong;

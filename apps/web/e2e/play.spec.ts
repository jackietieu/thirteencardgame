import { expect, test, type Page } from '@playwright/test';

interface CardRef {
	rank: number;
	suit: number;
}

interface MoveRef {
	type: string;
	cards: CardRef[];
}

interface ThirteenState {
	phase: 'playing' | 'handOver' | 'gameOver';
	turn: number;
}

interface ThirteenEngine {
	createGame: (seed?: number) => ThirteenState;
	legalMoves: (state: ThirteenState, seat: number) => MoveRef[];
	canPass: (state: ThirteenState, seat: number) => boolean;
}

interface Thirteen {
	store: { state: ThirteenState | null };
	engine: ThirteenEngine;
}

type Snapshot = {
	phase: ThirteenState['phase'];
	turn: number;
	moves: number[][];
	canPass: boolean;
	dealing: boolean;
} | null;

function readState(page: Page): Promise<Snapshot> {
	return page.evaluate(() => {
		const g = (window as unknown as { __thirteen?: Thirteen }).__thirteen;
		const state = g?.store.state;
		if (!state || !g) return null;
		return {
			phase: state.phase,
			turn: state.turn,
			moves: g.engine.legalMoves(state, 0).map((m) => m.cards.map((c) => c.rank * 4 + c.suit)),
			canPass: g.engine.canPass(state, 0),
			dealing: !!(g.store.dealing || g.store.dealingPending)
		};
	});
}

test('full game: deal, play hands vs bots, reach game over with scores', async ({ page }) => {
	test.setTimeout(150_000);

	// Probe for the smallest seed >= 1 where seat 0 holds the 3♠ (thus leads hand 0).
	await page.goto('/play?fast=1');
	await page.waitForFunction(() => !!(window as unknown as { __thirteen?: unknown }).__thirteen);
	const seed = await page.evaluate(() => {
		const g = (window as unknown as { __thirteen?: Thirteen }).__thirteen;
		if (!g) return -1;
		for (let s = 1; s < 10_000; s++) {
			if (g.engine.createGame(s).turn === 0) return s;
		}
		return -1;
	});
	expect(seed).toBeGreaterThan(0);

	await page.goto(`/play?fast=1&seed=${seed}`);
	await page.waitForFunction(() => !!(window as unknown as { __thirteen?: Thirteen }).__thirteen?.store.state);
	await page.getByTestId('deal-button').click();

	const deadline = Date.now() + 130_000;
	let finished = false;
	while (!finished && Date.now() < deadline) {
		const snap = await readState(page);
		if (!snap) {
			await page.waitForTimeout(100);
			continue;
		}
		if (snap.dealing) {
			await page.waitForTimeout(100);
			continue;
		}
		if (snap.phase === 'gameOver') {
			finished = true;
			break;
		}
		if (snap.phase === 'handOver') {
			await page.getByTestId('next-hand').click();
			continue;
		}
		if (snap.turn === 0) {
			if (snap.moves.length === 0) {
				await page.getByTestId('pass-button').click();
			} else {
				for (const key of snap.moves[0]!) {
					await page.locator(`[data-hand] [data-card="${key}"]`).click();
				}
				await page.getByTestId('play-button').click();
			}
		} else {
			await page.waitForTimeout(100);
		}
	}
	expect(finished, 'game reached game over in time').toBe(true);

	await expect(page.getByTestId('game-over')).toBeVisible();
	await expect(page.getByTestId('scoreboard')).toContainText(/You: \d+/);
});

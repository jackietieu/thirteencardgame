import { expect, test } from '@playwright/test';

interface CardRef {
	rank: number;
	suit: number;
}

interface Thirteen {
	store: {
		loadState: (state: unknown) => void;
		state: { turn: number } | null;
	};
	engine: {
		buildState: (options: Record<string, unknown>) => unknown;
	};
}

const card = (rank: number, suit: number): CardRef => ({ rank, suit });

test('four of a kind beats a single 2 and wins the trick', async ({ page }) => {
	await page.goto('/play?test=1&fast=1');
	await page.waitForFunction(() => !!(window as unknown as { __thirteen?: unknown }).__thirteen);

	await page.evaluate(() => {
		const g = (window as unknown as { __thirteen: Thirteen }).__thirteen;
		const c = (rank: number, suit: number) => ({ rank, suit });
		g.store.loadState(
			g.engine.buildState({
				// Seat 0: four 7s (bomb) + two fillers that cannot beat a 2.
				hands: [
					[c(3, 0), c(4, 0), c(7, 0), c(7, 1), c(7, 2), c(7, 3)],
					[c(5, 0), c(5, 1)],
					[c(6, 0), c(6, 1)],
					[c(8, 0), c(8, 1)]
				],
				turn: 0,
				handNumber: 1,
				opening: false,
				trick: {
					plays: [{ seat: 1, action: { type: 'single', cards: [c(15, 0)] } }],
					leader: 1
				}
			})
		);
	});

	// Select the four 7s.
	for (const suit of [0, 1, 2, 3]) {
		await page.locator(`[data-hand] [data-card="${7 * 4 + suit}"]`).click();
	}

	await page.getByTestId('play-button').click();

	// The other seats cannot follow a 2 (they hold no bombs), so they pass in
	// fast mode and the trick resolves to us.
	const lastTrick = page.getByTestId('last-trick');
	await expect(lastTrick).toContainText('You won with four of a kind, 7s');

	await expect(page.getByTestId('trick-pile')).toContainText('four of a kind, 7s');

	// The beaten 2♠ stays visible in the pile/last-trick summary; the log only
	// records moves committed after the scenario was loaded.
	await expect(page.getByTestId('trick-pile')).toContainText('2♠');
	const log = page.getByTestId('log-drawer');
	await log.locator('summary').click();
	await expect(log).toContainText('four of a kind, 7s');

	// Trick resolved to you: you lead the new trick.
	await expect(page.getByTestId('turn-banner')).toContainText('lead any combination');
});

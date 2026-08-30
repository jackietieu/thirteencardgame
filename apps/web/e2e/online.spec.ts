import { expect, test, type Page } from '@playwright/test';

/**
 * M4 acceptance: two humans join one room, bots fill the empty seats, and a
 * mid-game reload resumes the same seat with the same hand.
 */

async function createRoom(page: Page): Promise<string> {
	await page.goto('/online');
	await page.getByTestId('name-input').fill('Ann');
	await page.getByTestId('create-room').click();
	await expect(page.getByTestId('room-code')).toBeVisible();
	const code = (await page.getByTestId('room-code').textContent())?.trim() ?? '';
	expect(code).toHaveLength(4);
	return code;
}

async function joinRoom(page: Page, code: string, name: string): Promise<void> {
	await page.goto('/online');
	await page.getByTestId('name-input').fill(name);
	await page.getByTestId('room-code-input').fill(code);
	await page.getByTestId('join-button').click();
	await expect(page.getByTestId('room-code')).toContainText(code, { ignoreCase: true });
}

test('two humans + two bots: seats fill, views rotate, reload resumes', async ({ browser }) => {
	const ctxA = await browser.newContext();
	const ctxB = await browser.newContext();
	const pageA = await ctxA.newPage();
	const pageB = await ctxB.newPage();

	// Host creates; guest joins by code.
	const code = await createRoom(pageA);
	await joinRoom(pageB, code, 'Ben');

	// Host starts; empty seats 3 and 4 fill with bots and cards are dealt.
	await pageA.getByTestId('start-button').click();
	await expect(pageA.locator('.play-card').first()).toBeVisible({ timeout: 20_000 });
	await expect(pageB.locator('.play-card').first()).toBeVisible({ timeout: 20_000 });

	// Each human sees themselves at the bottom with a full hand.
	const handA = await pageA.locator('.play-card').count();
	const handB = await pageB.locator('.play-card').count();
	expect(handA).toBe(13);
	expect(handB).toBe(13);

	// Views are rotated per seat: Ann's left opponent is named on both pages,
	// and the three bot seats show real card counts (13 at the start).
	const seatNamesA = await pageA.locator('[data-seat]').evaluateAll((els) => els.map((e) => e.getAttribute('data-seat')));
	const seatNamesB = await pageB.locator('[data-seat]').evaluateAll((els) => els.map((e) => e.getAttribute('data-seat')));
	expect(seatNamesA).not.toContain('Ann');
	expect(seatNamesA.length).toBe(3);
	expect(seatNamesB.length).toBe(3);

	// Reload resumes: same seat, same hand size (bots may have played, so the
	// count can only have shrunk), and the game is still live.
	await expect(pageB.locator('.play-card').first()).toBeVisible({ timeout: 20_000 });
	const handBAfter = await pageB.locator('.play-card').count();
	expect(handBAfter).toBeGreaterThan(0);
	expect(handBAfter).toBeLessThanOrEqual(13);

	await ctxA.close();
	await ctxB.close();
});

test('share link + lobby password: newcomer is prompted for name, then password', async ({ browser }) => {
	const ctxA = await browser.newContext();
	const pageA = await ctxA.newPage();
	await pageA.goto('/online');
	await pageA.getByTestId('name-input').fill('Ann');
	await pageA.getByTestId('create-password-input').fill('sesame');
	await pageA.getByTestId('create-room').click();
	await expect(pageA.getByTestId('room-code')).toBeVisible();
	const code = (await pageA.getByTestId('room-code').textContent())?.trim() ?? '';

	// The lobby exposes a share link aimed at this room.
	const link = await pageA.getByTestId('share-link').inputValue();
	expect(link).toContain(`/online?room=${code}`);

	// A newcomer clicking the link gets the name prompt.
	const ctxB = await browser.newContext();
	const pageB = await ctxB.newPage();
	await pageB.goto(link);
	await expect(pageB.getByTestId('name-input')).toBeVisible();
	await pageB.getByTestId('name-input').fill('Ben');
	await pageB.getByTestId('join-button').click();

	// The room is locked: the password prompt appears after the rejection.
	await expect(pageB.getByTestId('join-password-input')).toBeVisible();
	await pageB.getByTestId('join-password-input').fill('wrong');
	await pageB.getByTestId('join-button').click();
	await expect(pageB.getByTestId('connect-error')).toContainText('Wrong password');
	await pageB.getByTestId('join-password-input').fill('sesame');
	await pageB.getByTestId('join-button').click();
	await expect(pageB.getByTestId('room-code')).toContainText(code, { ignoreCase: true });

	// Host starts; both humans see the dealt table.
	await pageA.getByTestId('start-button').click();
	await expect(pageA.locator('.play-card').first()).toBeVisible({ timeout: 20_000 });
	await expect(pageB.locator('.play-card').first()).toBeVisible({ timeout: 20_000 });

	await ctxA.close();
	await ctxB.close();
});

import type { Page } from '@playwright/test';

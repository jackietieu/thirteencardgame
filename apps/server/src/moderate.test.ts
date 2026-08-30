import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moderateText, moderationEnabled, resetRateLimitBackoff } from './moderate.js';

/** Fetch mock returning an OpenAI moderations payload. */
function mockFetch(status: number, body: unknown) {
	return vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(JSON.stringify(body), { status }))
	);
}

function scores(entries: Record<string, number>) {
	return { results: [{ flagged: true, category_scores: entries }] };
}

beforeEach(() => {
	process.env.OPENAI_API_KEY = 'test-key';
	delete process.env.OPENAI_MODERATION;
	resetRateLimitBackoff();
});

afterEach(() => {
	vi.unstubAllGlobals();
	delete process.env.OPENAI_API_KEY;
	delete process.env.OPENAI_MODERATION;
});

describe('moderateText', () => {
	it('allows text below the lenient threshold', async () => {
		mockFetch(200, scores({ harassment: 0.4, hate: 0.3, violence: 0.55 }));
		await expect(moderateText('trash talk')).resolves.toBe(true);
	});

	it('blocks text at or above the threshold', async () => {
		mockFetch(200, scores({ harassment: 0.85, hate: 0.1 }));
		await expect(moderateText('abuse')).resolves.toBe(false);
	});

	it('blocks sexual/minors far below the general bar', async () => {
		mockFetch(200, scores({ 'sexual/minors': 0.4 }));
		await expect(moderateText('grooming')).resolves.toBe(false);
	});

	it('fails open on API errors, non-200s, and malformed payloads', async () => {
		mockFetch(500, {});
		await expect(moderateText('x')).resolves.toBe(true);
		mockFetch(200, { results: [] });
		await expect(moderateText('x')).resolves.toBe(true);
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('network down');
			})
		);
		await expect(moderateText('x')).resolves.toBe(true);
	});

	it('backs off after a 429 instead of re-calling the API', async () => {
		const fetchSpy = vi.fn(async () => new Response('{"error":{}}', { status: 429 }));
		vi.stubGlobal('fetch', fetchSpy);
		await expect(moderateText('first')).resolves.toBe(true);
		await expect(moderateText('second')).resolves.toBe(true);
		expect(fetchSpy).toHaveBeenCalledTimes(1); // second call served by backoff
	});

	it('passes through when disabled or without a key', async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);
		process.env.OPENAI_MODERATION = 'off';
		expect(moderationEnabled()).toBe(false);
		await expect(moderateText('anything')).resolves.toBe(true);
		delete process.env.OPENAI_MODERATION;
		delete process.env.OPENAI_API_KEY;
		await expect(moderateText('anything')).resolves.toBe(true);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});

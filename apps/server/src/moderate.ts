/**
 * Chat moderation via the OpenAI v1 Moderations API.
 *
 * Policy: deliberately lenient. A message is blocked only when a category
 * score reaches BLOCK_THRESHOLD (0.7 — well past OpenAI's own flagged
 * boundary), except sexual/minors which blocks far lower. Borderline banter
 * (trash talk, mild profanity, game violence talk) scores well below the bar
 * and passes.
 *
 * Failure policy: fail open. Chat is low-stakes between four invited players;
 * a transient API outage must not silence the room. Without OPENAI_API_KEY
 * moderation is off entirely; OPENAI_MODERATION=off force-disables it.
 * A 429 starts a 60s backoff so an exhausted quota doesn't tax every message
 * with a doomed round-trip.
 */
const MODEL = 'omni-moderation-latest';
/** Override for proxies/self-hosted gateways; defaults to the official API. */
const OPENAI_URL = `${process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'}/moderations`;
const BLOCK_THRESHOLD = 0.7;
/** Grooming/CSAM signals block far below the general bar. */
const HARD_THRESHOLD = 0.3;
const TIMEOUT_MS = 4000;
const RATE_LIMIT_BACKOFF_MS = 60_000;

let rateLimitedUntil = 0;

/** True when a moderation provider will be consulted. */
export function moderationEnabled(): boolean {
	if (process.env.OPENAI_MODERATION === 'off') return false;
	return Boolean(process.env.OPENAI_API_KEY);
}

/** Returns true when the text may be shown. Never throws. */
export async function moderateText(text: string): Promise<boolean> {
	if (!moderationEnabled()) return true;
	if (Date.now() < rateLimitedUntil) return true; // quota exhausted — fail open
	try {
		const res = await fetch(OPENAI_URL, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${process.env.OPENAI_API_KEY}`
			},
			body: JSON.stringify({ model: MODEL, input: text }),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (!res.ok) {
			if (res.status === 429) rateLimitedUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
			return true; // fail open
		}
		const body = (await res.json()) as {
			results?: { category_scores?: Record<string, number> }[];
		};
		const scores = body.results?.[0]?.category_scores;
		if (!scores) return true;
		for (const [category, score] of Object.entries(scores)) {
			const threshold = category === 'sexual/minors' ? HARD_THRESHOLD : BLOCK_THRESHOLD;
			if (score >= threshold) return false;
		}
		return true;
	} catch {
		return true; // network/parse/timeout — fail open
	}
}

/** Test hook: clears the 429 backoff. */
export function resetRateLimitBackoff() {
	rateLimitedUntil = 0;
}

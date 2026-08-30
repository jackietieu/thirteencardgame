/** Deterministic hue from a player name — drives avatar colors. */
export function nameHue(name: string): number {
	let h = 7;
	for (const ch of name) h = (h * 31 + (ch.codePointAt(0) ?? 0)) % 360;
	return h;
}

/** Fan arc transform for card `i` of `n`: shallow rotation + quadratic drop. */
export function arcFor(i: number, n: number): { rot: string; y: string; z: number } {
	const mid = (n - 1) / 2;
	const d = i - mid;
	return {
		rot: `${(d * 1.2).toFixed(2)}deg`,
		y: `${(d * d * 0.55).toFixed(1)}px`,
		z: i + 1
	};
}

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Loads `KEY=VALUE` lines from the nearest `.env.local` at or above `from`
 * (cwd when omitted). Values already in the environment win — the file only
 * fills gaps. `.env.local` is gitignored; secrets live there, never in code.
 */
export function loadEnvLocal(from: string = process.cwd()): void {
	let dir = resolve(from);
	for (;;) {
		const file = resolve(dir, '.env.local');
		if (existsSync(file)) {
			apply(file);
			return;
		}
		const parent = resolve(dir, '..');
		if (parent === dir) return;
		dir = parent;
	}
}

function apply(file: string): void {
	let text: string;
	try {
		text = readFileSync(file, 'utf8');
	} catch {
		return;
	}
	for (const line of text.split('\n')) {
		const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
		if (!m) continue;
		let value = m[2]!;
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (process.env[m[1]!] === undefined) process.env[m[1]!] = value;
	}
}

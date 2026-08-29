<script lang="ts">
	import type { Phase } from '@thirteen/engine';
	import { SEAT_NAMES } from '$lib/game.svelte';

	interface Props {
		scores: number[];
		finished: number[];
		handNumber: number;
		phase: Phase;
		winner: number | null;
		onNextHand: () => void;
	}

	let { scores, finished, handNumber, phase, winner, onNextHand }: Props = $props();
</script>

<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-900/60 px-4 py-2">
	<div class="flex items-center gap-3 text-sm" data-testid="scoreboard">
		<span class="font-semibold text-emerald-100">Hand {handNumber + 1}</span>
		{#each SEAT_NAMES as name, seat (name)}
			<span
				class="rounded-full px-2 py-0.5
					{finished.includes(seat) ? 'bg-emerald-700/70 text-emerald-100' : 'bg-emerald-950/60 text-emerald-300'}"
			>
				{name}: {scores[seat] ?? 0}
			</span>
		{/each}
	</div>

	{#if phase === 'gameOver'}
		<div data-testid="game-over" class="flex items-center gap-3">
			<span class="text-lg font-bold text-amber-300">
				Game over — {SEAT_NAMES[winner ?? 0]} wins!
			</span>
			<button
				type="button"
				onclick={onNextHand}
				class="rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
			>
				New game
			</button>
		</div>
	{:else if phase === 'handOver'}
		<button
			type="button"
			data-testid="next-hand"
			onclick={onNextHand}
			class="rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-950 shadow transition hover:bg-emerald-400"
		>
			Next hand
		</button>
	{/if}
</div>

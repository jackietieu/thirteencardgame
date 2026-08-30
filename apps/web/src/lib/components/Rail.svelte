<script lang="ts">
	import type { Phase } from '@thirteen/engine';
	import type { Snippet } from 'svelte';

	interface Props {
		scores: number[];
		names: string[];
		finished: number[];
		handNumber: number;
		phase: Phase;
		winner: number | null;
		turn: number;
		nav?: Snippet;
	}

	let { scores, names, finished, handNumber, phase, winner, turn, nav }: Props = $props();

	const SPADE =
		'M12 2C8.4 6.9 4 9.2 4 13.1a4.1 4.1 0 0 0 7.2 2.7c-.3 2.5-1.4 4-3.2 5.2h8c-1.8-1.2-2.9-2.7-3.2-5.2a4.1 4.1 0 0 0 7.2-2.7C20 9.2 15.6 6.9 12 2z';
</script>

<header class="rail">
	<div class="flex items-center gap-2">
		<svg viewBox="0 0 24 24" class="size-5 text-accent" aria-hidden="true"
			><path d={SPADE} fill="currentColor" /></svg
		>
		<span class="rail-word">Thirteen</span>
	</div>
	<span class="rail-hand">Hand {handNumber + 1}</span>
	<div class="flex items-center gap-1.5" data-testid="scoreboard">
		{#each names as name, seat (name)}
			<span
				class="score-chip {turn === seat && phase === 'playing' ? 'chip-turn' : ''} {finished.includes(
					seat
				)
					? 'chip-done'
					: ''}"
			>
				<span class="score-name">{name}:</span>
				<span class="score-num">{scores[seat] ?? 0}</span>
			</span>
		{/each}
	</div>
	<div class="ml-auto flex items-center gap-1">
		{#if phase === 'gameOver'}
			<div data-testid="game-over" class="mr-1 flex items-center gap-2">
				<span class="font-display text-sm font-bold text-gold">{names[winner ?? 0]} wins!</span>
			</div>
		{:else if phase === 'handOver'}
			<span class="mr-1 text-sm text-ink-muted">Hand over</span>
		{/if}
		{@render nav?.()}
	</div>
</header>

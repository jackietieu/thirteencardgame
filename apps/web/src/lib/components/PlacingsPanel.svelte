<script lang="ts">
	import type { Phase } from '@thirteen/engine';
	import { displayName, t } from '$lib/i18n.svelte';
	import Avatar from './Avatar.svelte';

	interface Props {
		scores: number[];
		names: string[];
		finished: number[];
		handNumber: number;
		phase: Phase;
		winner: number | null;
		onNextHand: () => void;
	}

	let { scores, names, finished, handNumber, phase, winner, onNextHand }: Props = $props();

	/** Finish order first, then the seat still holding cards. */
	const placings = $derived.by(() => {
		const left = [0, 1, 2, 3].filter((s) => !finished.includes(s));
		return [...finished, ...left];
	});

	/** handNumber is 0-based, so the round that just finished is handNumber + 1. */
	const roundNumber = $derived(handNumber + 1);
</script>

{#if phase === 'handOver' || phase === 'gameOver'}
	<div class="overlay">
		<div class="panel" data-testid="game-over-panel" role="dialog" aria-modal="true">
			{#if phase === 'gameOver'}
				<h2 class="panel-title">{t('place.gameOver', { name: displayName(names[winner ?? 0]) })}</h2>
			{:else}
				<h2 class="panel-title">{t('place.roundWon', { name: displayName(names[finished[0] ?? placings[0] ?? 0]), n: roundNumber })}</h2>
			{/if}
			<ol class="placings">
				{#each placings as seat, i (seat)}
					<li class="{i === 0 ? 'place-first' : ''}">
						<span class="place-rank">{i + 1}</span>
						<Avatar name={names[seat]} />
						<span class="place-name">{names[seat]}</span>
						<span class="place-score">{t('place.pts', { n: scores[seat] ?? 0 })}</span>
					</li>
				{/each}
			</ol>
			{#if phase === 'handOver'}
				<button type="button" data-testid="next-hand" class="btn-primary" onclick={onNextHand}>
					{t('place.nextHand')}
				</button>
			{:else}
				<button type="button" class="btn-primary" onclick={onNextHand}>{t('place.newGame')}</button>
			{/if}
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 70;
		display: grid;
		place-items: center;
		background: rgb(2 10 7 / 0.55);
		backdrop-filter: blur(3px);
		animation: overlay-in var(--dur-base) var(--ease-card);
	}
	@keyframes overlay-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.1rem;
		width: min(24rem, calc(100vw - 2rem));
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-panel);
		box-shadow: var(--shadow-card-lift);
		padding: 1.75rem 1.5rem;
		animation: panel-in var(--dur-slow) var(--ease-card);
	}
	@keyframes panel-in {
		from {
			opacity: 0;
			transform: translateY(14px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	.panel-title {
		font-family: var(--font-display);
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--color-gold);
		text-align: center;
	}
	.placings {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.placings li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.35rem 0.6rem;
		border-radius: 0.75rem;
		background: var(--color-surface-raised);
	}
	.place-first {
		outline: 1.5px solid var(--color-gold);
	}
	.place-rank {
		width: 1.25rem;
		font-family: var(--font-display);
		font-weight: 700;
		color: var(--color-ink-subtle);
		font-variant-numeric: tabular-nums;
	}
	.place-first .place-rank {
		color: var(--color-gold);
	}
	.place-name {
		flex: 1;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.place-score {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-ink-muted);
		font-variant-numeric: tabular-nums;
	}
</style>

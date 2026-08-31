<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import Avatar from './Avatar.svelte';
	import CardBack from './CardBack.svelte';

	interface Props {
		name: string;
		position: 'left' | 'top' | 'right';
		cardCount: number;
		isTurn: boolean;
		passed: boolean;
		out: boolean;
	}

	let { name, position, cardCount, isTurn, passed, out }: Props = $props();

	const shownBacks = $derived(Math.min(cardCount, 13));
	const posClass = $derived(position === 'top' ? 'pod-n' : position === 'left' ? 'pod-w' : 'pod-e');
</script>

<div data-seat={name} class="pod {posClass} {out ? 'pod-out' : ''}">
	<div class="pod-card {isTurn ? 'pod-turn pulse-turn' : ''}">
		<Avatar {name} dim={out} />
		<div class="pod-info">
			<span class="pod-name">{name}</span>
			<span class="pod-meta">
				<span class="pod-count">{t(cardCount === 1 ? 'seat.cardCount.one' : 'seat.cardCount', { n: cardCount })}</span>
				{#if out}
					<span class="chip chip-out">{t('seat.out')}</span>
				{:else if passed}
					<span class="chip chip-pass">{t('seat.passed')}</span>
				{:else if isTurn}
					<span class="chip chip-think pulse-dot">{t('seat.thinking')}</span>
				{/if}
			</span>
		</div>
		{#if !out}
			<div class="pod-backs" aria-hidden="true">
				{#each Array(shownBacks) as _, i (i)}
					<CardBack class={i > 0 ? 'back-overlap' : ''} />
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.pod-card {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: color-mix(in oklab, var(--color-surface) 84%, transparent);
		backdrop-filter: blur(8px);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-pod);
		padding: 0.4rem 0.65rem;
		box-shadow: var(--shadow-pod);
		transition: border-color var(--dur-base);
	}
	.pod-turn {
		border-color: var(--color-gold);
	}
	.pod-out {
		opacity: 0.5;
	}
	.pod-info {
		display: flex;
		flex-direction: column;
		line-height: 1.25;
		min-width: 0;
	}
	.pod-name {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-ink);
		max-width: 8rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pod-meta {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.pod-count {
		font-size: 0.6875rem;
		color: var(--color-ink-subtle);
		font-variant-numeric: tabular-nums;
	}
	.chip {
		font-size: 0.5625rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		border-radius: 999px;
		padding: 0.1rem 0.4rem;
	}
	.chip-out {
		color: var(--color-accent);
		background: color-mix(in oklab, var(--color-accent) 16%, transparent);
	}
	.chip-think {
		color: var(--color-ink-muted);
		background: var(--color-surface-raised);
	}
	.pod-backs {
		display: flex;
		--back-w: calc(var(--card-w) * 0.32);
	}
	.pod-backs :global(.cback + .cback) {
		margin-left: calc(var(--back-w) * -0.72);
	}
	@media (max-width: 700px) {
		.pod-backs {
			display: none;
		}
	}
</style>

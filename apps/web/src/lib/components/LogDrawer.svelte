<script lang="ts">
	import type { LogEntry } from '$lib/driver';
	import { describeMoveI18n, t } from '$lib/i18n.svelte';
	import Card from './Card.svelte';

	interface Props {
		log: LogEntry[];
		names: string[];
	}

	let { log, names }: Props = $props();

	let open = $state(false);

	// Newest first for display.
	const entries = $derived([...log].reverse());
</script>

<details data-testid="log-drawer" bind:open class="log-drawer">
	<summary class="icon-btn" aria-label={t('log.aria')} title={t('log.aria')}>
		<svg viewBox="0 0 24 24" class="size-5" aria-hidden="true"
			><path
				d="M4 6h16M4 12h16M4 18h10"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				fill="none"
			/></svg
		>
		<span class="log-count">{log.length}</span>
	</summary>
	<div class="log-panel">
		<div class="log-head">{t('log.title')}</div>
		<ol>
			{#each entries as entry, i (log.length - i)}
				<li>
					<span class="log-hand">{t('log.hand', { n: entry.handNumber + 1 })}</span>
					<span class="log-name">{names[entry.seat]}</span>
					{#if entry.action.type !== 'pass'}
						<span class="log-cards">
							{#each entry.action.cards as card (card.rank * 4 + card.suit)}
								<Card {card} size="mini" />
							{/each}
						</span>
					{/if}
					<span class="log-move">{describeMoveI18n(entry.action)}</span>
				</li>
			{:else}
				<li class="log-empty">{t('log.empty')}</li>
			{/each}
		</ol>
	</div>
</details>

<style>
	.log-drawer {
		position: relative;
	}
	summary.icon-btn {
		list-style: none;
		position: relative;
	}
	summary.icon-btn::-webkit-details-marker {
		display: none;
	}
	.log-count {
		position: absolute;
		top: 0.3rem;
		right: 0.3rem;
		font-size: 0.5625rem;
		font-weight: 700;
		color: var(--color-ink-subtle);
		font-variant-numeric: tabular-nums;
	}
	.log-drawer:not([open]) .log-panel {
		display: none;
	}
	.log-panel {
		position: fixed;
		top: 3.4rem;
		right: 0.75rem;
		z-index: 60;
		width: min(21rem, calc(100vw - 1.5rem));
		max-height: min(34rem, 70dvh);
		display: flex;
		flex-direction: column;
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-panel);
		box-shadow: var(--shadow-card-lift);
		padding: 0.75rem;
	}
	.log-head {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--color-ink);
		padding: 0 0.25rem 0.5rem;
		border-bottom: 1px solid var(--color-hairline);
		margin-bottom: 0.5rem;
	}
	ol {
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.75rem;
		color: var(--color-ink-muted);
		padding: 0 0.25rem;
	}
	li {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.log-hand {
		color: var(--color-ink-subtle);
		font-variant-numeric: tabular-nums;
	}
	.log-name {
		font-weight: 600;
		color: var(--color-ink);
	}
	.log-cards {
		display: inline-flex;
	}
	.log-cards :global(.card-mini + .card-mini) {
		margin-left: -0.7rem;
	}
	.log-move {
		color: var(--color-ink-muted);
	}
	.log-empty {
		font-style: italic;
		color: var(--color-ink-subtle);
	}
</style>

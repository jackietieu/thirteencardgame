<script lang="ts">
	import { cardLabel, rankLabel, SUIT_GLYPHS, type Card } from '@thirteen/engine';
	import { cardNameI18n } from '$lib/i18n.svelte';

	interface Props {
		card: Card;
		selected?: boolean;
		disabled?: boolean;
		highlighted?: boolean;
		/** Size context: 'fan' = your hand, 'table' = on the felt, 'mini' = log/recaps. */
		size?: 'fan' | 'table' | 'mini';
		onselect?: () => void;
	}

	let { card, selected = false, disabled = false, highlighted = false, size = 'fan', onselect }: Props =
		$props();

	// Inline SVG paths (24×24) so glyphs render identically on every OS.
	// Index = suit: 0 ♠, 1 ♣, 2 ♦, 3 ♥.
	const SUIT_PATHS: readonly string[] = [
		'M12 2C8.4 6.9 4 9.2 4 13.1a4.1 4.1 0 0 0 7.2 2.7c-.3 2.5-1.4 4-3.2 5.2h8c-1.8-1.2-2.9-2.7-3.2-5.2a4.1 4.1 0 0 0 7.2-2.7C20 9.2 15.6 6.9 12 2z',
		'M12 2a4.3 4.3 0 0 0-4.2 5.3A4.3 4.3 0 1 0 10.7 15c-.3 2.6-1.4 4.4-3.2 5.7h9c-1.8-1.3-2.9-3.1-3.2-5.7a4.3 4.3 0 1 0 2.9-7.7A4.3 4.3 0 0 0 12 2z',
		'M12 1.5 19.5 12 12 22.5 4.5 12z',
		'M12 21.5C6.2 17.1 3 13.6 3 9.9 3 6.9 5.4 4.5 8.3 4.5c1.5 0 2.9.7 3.7 1.9.8-1.2 2.2-1.9 3.7-1.9 2.9 0 5.3 2.4 5.3 5.4 0 3.7-3.2 7.2-9 11.6z'
	];
	const isRed = $derived(card.suit >= 2);
	const path = $derived(SUIT_PATHS[card.suit]);
</script>

{#if size === 'mini'}
	<span class="card-mini {isRed ? 'card-red' : ''}" aria-hidden="true">
		{rankLabel(card.rank)}{SUIT_GLYPHS[card.suit]}
	</span>
{:else if size === 'table'}
	<div class="card-face table-card {isRed ? 'card-red' : ''}" role="img" aria-label={cardNameI18n(card)}>
		<span class="strip" aria-hidden="true">
			<span class="strip-rank">{rankLabel(card.rank)}</span>
		</span>
		<span class="center" aria-hidden="true">
			<span class="center-rank">{rankLabel(card.rank)}</span>
			<svg viewBox="0 0 24 24" class="center-suit"><path d={path} fill="currentColor" /></svg>
		</span>
		<span class="card-text" aria-hidden="true">{cardLabel(card)}</span>
	</div>
{:else}
	<button
		type="button"
		data-card={card.rank * 4 + card.suit}
		aria-label={cardNameI18n(card)}
		aria-pressed={selected}
		{disabled}
		onclick={() => onselect?.()}
		class="card-face play-card {isRed ? 'card-red' : ''} {selected ? 'play-card-selected' : ''}
			{highlighted && !selected ? 'play-card-glow' : ''}"
	>
		<span class="strip" aria-hidden="true">
			<span class="strip-rank">{rankLabel(card.rank)}</span>
			<svg viewBox="0 0 24 24" class="strip-suit"><path d={path} fill="currentColor" /></svg>
		</span>
		<span class="center" aria-hidden="true">
			<span class="center-rank">{rankLabel(card.rank)}</span>
			<svg viewBox="0 0 24 24" class="center-suit"><path d={path} fill="currentColor" /></svg>
		</span>
		<span class="card-text" aria-hidden="true">{cardLabel(card)}</span>
	</button>
{/if}

<style>
	.card-face {
		position: relative;
		width: var(--card-w);
		aspect-ratio: 2.5 / 3.5;
		border-radius: calc(var(--card-w) * 0.09);
		background: linear-gradient(158deg, var(--color-card-face), oklch(0.955 0.006 95));
		box-shadow:
			var(--shadow-card),
			inset 0 0 0 1px rgb(25 33 42 / 0.1);
		color: var(--color-card-black);
		flex-shrink: 0;
		container-type: inline-size;
	}
	.card-red {
		color: var(--color-card-red);
	}
	/* Suit wash. */
	.card-face::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: radial-gradient(
			90% 70% at 18% 12%,
			color-mix(in oklab, currentColor 6%, transparent),
			transparent 62%
		);
		pointer-events: none;
	}

	/* Strip band: the only guaranteed-visible region in an overlapped fan. */
	.strip {
		position: absolute;
		top: 6%;
		left: 8%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6%;
		line-height: 1;
	}
	.strip-rank {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: calc(var(--card-w) * 0.2);
	}
	.strip-suit {
		width: calc(var(--card-w) * 0.2);
		height: calc(var(--card-w) * 0.2);
	}

	.center {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2%;
		line-height: 1;
		transform: translateY(4%);
	}
	.center-rank {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: calc(var(--card-w) * 0.5);
	}
	.center-suit {
		width: calc(var(--card-w) * 0.32);
		height: calc(var(--card-w) * 0.32);
	}
	/* Tiny cards: the strip carries identity alone. */
	@container (max-width: 53px) {
		.center {
			display: none;
		}
	}
	/* Visually hidden but present in innerText for test contracts ("2♠"). */
	.card-text {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	/* Felt cards. */
	.table-card {
		width: var(--table-card-w);
	}

	/* Hand cards. */
	.play-card {
		user-select: none;
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
		transform: translateY(var(--arc-y, 0px)) rotate(var(--rot, 0deg));
		z-index: var(--z, 1);
		transition:
			transform var(--dur-fast) var(--ease-card),
			box-shadow var(--dur-fast) var(--ease-card),
			opacity var(--dur-fast) var(--ease-card),
			filter var(--dur-fast) var(--ease-card);
	}
	.play-card:not(:disabled):hover {
		transform: translateY(calc(var(--arc-y, 0px) - 6px)) rotate(0deg);
		box-shadow: var(--shadow-card-lift);
		z-index: 40;
	}
	.play-card-glow {
		box-shadow:
			inset 0 0 0 2px var(--color-accent),
			0 0 14px color-mix(in oklab, var(--color-accent) 35%, transparent),
			var(--shadow-card);
		transform: translateY(calc(var(--arc-y, 0px) - 3px)) rotate(var(--rot, 0deg));
	}
	/* Higher specificity than the :hover rule above: a selected card stays
	   raised even while the pointer rests on it, and drops the moment it is
	   deselected (transition still animates the move). */
	.play-card.play-card-selected {
		transform: translateY(calc(var(--arc-y, 0px) - 18px)) rotate(0deg);
		box-shadow:
			0 0 0 2px var(--color-gold),
			var(--shadow-card-lift);
		z-index: 50;
	}
	.play-card.play-card-selected:hover {
		transform: translateY(calc(var(--arc-y, 0px) - 18px)) rotate(0deg);
	}

	/* Log / recap mini label. */
	.card-mini {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 1px;
		width: 1.55rem;
		height: 2.15rem;
		border-radius: 0.3rem;
		background: var(--color-card-face);
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.35);
		color: var(--color-card-black);
		font-family: var(--font-display);
		font-size: 0.7rem;
		font-weight: 700;
		flex-shrink: 0;
	}
</style>

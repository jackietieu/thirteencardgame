<script lang="ts">
	import { cardName, rankLabel, type Card } from '@thirteen/engine';

	interface Props {
		card: Card;
		selected?: boolean;
		disabled?: boolean;
		highlighted?: boolean;
		size?: 'sm' | 'md';
		onselect?: () => void;
	}

	let { card, selected = false, disabled = false, highlighted = false, size = 'md', onselect }: Props =
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

<button
	type="button"
	data-card={card.rank * 4 + card.suit}
	aria-label={cardName(card)}
	aria-pressed={selected}
	{disabled}
	onclick={() => onselect?.()}
	class="play-card {size === 'sm' ? 'play-card-sm' : 'play-card-md'} {isRed ? 'text-red-600' : 'text-neutral-900'}
		{selected ? 'play-card-selected' : ''}
		{highlighted && !selected ? 'play-card-glow' : ''}
		{disabled ? 'play-card-disabled' : ''}"
>
	<span class="corner" aria-hidden="true">
		<span class="corner-rank">{rankLabel(card.rank)}</span>
		<svg viewBox="0 0 24 24" class="corner-suit"><path d={path} fill="currentColor" /></svg>
	</span>
	<span class="center" aria-hidden="true">
		<svg viewBox="0 0 24 24" class="center-suit"><path d={path} fill="currentColor" /></svg>
		<span class="center-rank">{rankLabel(card.rank)}</span>
	</span>
</button>

<style>
	.play-card {
		position: relative;
		aspect-ratio: 2.5 / 3.5;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.5rem;
		background: white;
		box-shadow: 0 2px 6px rgb(0 0 0 / 0.35);
		border: 1px solid rgb(0 0 0 / 0.15);
		font-weight: 700;
		user-select: none;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease,
			opacity 0.15s ease;
	}
	.play-card-md {
		width: 4.25rem;
	}
	.play-card-sm {
		width: 2.25rem;
	}
	@media (max-width: 640px) {
		.play-card-md {
			width: 3.25rem;
		}
	}
	.play-card:not(:disabled):hover {
		transform: translateY(-0.25rem);
	}
	.play-card-selected {
		transform: translateY(-1rem);
		box-shadow:
			0 0 0 2px var(--color-amber-400, #fbbf24),
			0 6px 14px rgb(0 0 0 / 0.4);
	}
	.play-card-selected:hover {
		transform: translateY(-1rem);
	}
	.play-card-glow {
		box-shadow:
			0 0 0 2px rgb(52 211 153 / 0.9),
			0 2px 10px rgb(52 211 153 / 0.45);
	}
	.play-card-disabled {
		opacity: 0.55;
	}
	.corner {
		position: absolute;
		top: 0.15rem;
		left: 0.25rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1;
	}
	.corner-rank {
		font-size: 0.75rem;
	}
	.corner-suit {
		width: 0.6rem;
		height: 0.6rem;
	}
	.center {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1;
	}
	.center-rank {
		font-size: 1.4rem;
	}
	.center-suit {
		width: 1.1rem;
		height: 1.1rem;
	}
	.play-card-sm .center-suit,
	.play-card-sm .center-rank {
		display: none;
	}
</style>

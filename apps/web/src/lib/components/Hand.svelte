<script lang="ts">
	import type { Card as EngineCard } from '@thirteen/engine';
	import { cardKey } from '$lib/highlight';
	import { arcFor } from '$lib/ui';
	import Card from './Card.svelte';

	interface Props {
		cards: EngineCard[];
		selected: Set<string>;
		onToggle: (card: EngineCard) => void;
		myTurn: boolean;
		highlighted: Set<string>;
		disabled: boolean;
	}

	let { cards, selected, onToggle, myTurn, highlighted, disabled }: Props = $props();

	let wrapEl: HTMLDivElement | undefined = $state();
	let wrapW = $state(0);
	let cardW = $state(68);

	// Track the dock width + the CSS-computed card size so rows can split
	// before the fan would overflow (portrait phones get two rows).
	$effect(() => {
		const el = wrapEl;
		if (!el) return;
		const measure = () => {
			wrapW = el.clientWidth;
			const cw = parseFloat(getComputedStyle(el).getPropertyValue('--card-w'));
			if (!Number.isNaN(cw) && cw > 0) cardW = cw;
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	});

	const rows = $derived.by(() => {
		const n = cards.length;
		if (n === 0 || wrapW === 0) return [cards];
		const stripFit = (wrapW - cardW) / Math.max(1, n - 1);
		if (stripFit >= 26) return [cards];
		const first = Math.ceil(n / 2);
		return [cards.slice(0, first), cards.slice(first)];
	});

	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		const buttons = [...(wrapEl?.querySelectorAll('button.play-card') ?? [])] as HTMLElement[];
		if (buttons.length === 0) return;
		const idx = buttons.indexOf(document.activeElement as HTMLElement);
		if (idx === -1) return;
		event.preventDefault();
		const next =
			event.key === 'ArrowRight'
				? Math.min(idx + 1, buttons.length - 1)
				: Math.max(idx - 1, 0);
		buttons[next]?.focus();
	}
</script>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions — roving arrow-key focus across card buttons -->
<div data-hand bind:this={wrapEl} onkeydown={onKeydown} role="group" aria-label="Your cards">
	{#each rows as row, r (r)}
		<div class="fan-row">
			{#each row as card, i (cardKey(card))}
				{@const arc = arcFor(i, row.length)}
				<span
					class="fan-slot {selected.has(cardKey(card)) ? 'slot-selected' : ''}"
					style="--rot: {arc.rot}; --arc-y: {arc.y}; --z: {arc.z}"
				>
					<Card
						{card}
						selected={selected.has(cardKey(card))}
						highlighted={myTurn && highlighted.has(cardKey(card))}
						{disabled}
						onselect={() => onToggle(card)}
					/>
				</span>
			{/each}
		</div>
	{/each}
</div>

<style>
	.fan-slot {
		position: relative;
		display: inline-flex;
		z-index: var(--z, 1);
	}
	.fan-slot:hover {
		z-index: 40;
	}
	.slot-selected {
		z-index: 50;
	}
</style>

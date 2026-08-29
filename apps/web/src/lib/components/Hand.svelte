<script lang="ts">
	import type { Card as EngineCard } from '@thirteen/engine';
	import { cardKey } from '$lib/highlight';
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
</script>

<div data-hand class="flex flex-wrap items-end justify-center gap-1 sm:gap-1.5 md:gap-2">
	{#each cards as card (cardKey(card))}
		<Card
			{card}
			selected={selected.has(cardKey(card))}
			highlighted={myTurn && highlighted.has(cardKey(card))}
			{disabled}
			onselect={() => onToggle(card)}
		/>
	{/each}
</div>

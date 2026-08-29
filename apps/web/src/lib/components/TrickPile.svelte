<script lang="ts">
	import { cardLabel, describeMove, type Card, type Trick } from '@thirteen/engine';
	import { SEAT_NAMES } from '$lib/game.svelte';

	interface Props {
		trick: Trick;
		lastTrick: Trick | null;
	}

	let { trick, lastTrick }: Props = $props();

	function label(card: Card): string {
		return cardLabel(card);
	}

	function playedCards(t: Trick): Card[] {
		return t.plays.filter((p) => p.action.type !== 'pass').flatMap((p) => p.action.cards);
	}
</script>

<div
	data-testid="trick-pile"
	class="flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-emerald-800/50 bg-emerald-950/40 p-3"
>
	{#if trick.plays.length === 0}
		<p class="text-sm text-emerald-300/70">
			{lastTrick ? 'New trick' : 'Opening lead'} — {SEAT_NAMES[trick.leader]} leads
		</p>
	{/if}
	<div class="flex flex-wrap items-start justify-center gap-3">
		{#each trick.plays as play, playIdx (playIdx)}
			{@const action = play.action}
			<div class="flex flex-col items-center gap-1" data-testid={`trick-play-${play.seat}`}>
				<span class="text-xs font-semibold text-emerald-200">{SEAT_NAMES[play.seat]}</span>
				{#if action.type === 'pass'}
					<span
						class="rounded-lg border border-emerald-800/60 px-2 py-3 text-xs text-emerald-400/80 italic"
					>
						pass
					</span>
				{:else}
					<div class="flex">
						{#each action.cards as card, i (card.rank * 4 + card.suit)}
							<span
								class="mini-card {card.suit >= 2 ? 'text-red-600' : 'text-neutral-900'} {i > 0 ? '-ml-3' : ''}"
							>
								{label(card)}
							</span>
						{/each}
					</div>
					<span class="text-[11px] text-emerald-300/80">{describeMove(action)}</span>
				{/if}
			</div>
		{/each}
	</div>

	{#if trick.plays.length === 0 && lastTrick && lastTrick.plays.length > 0}
		{@const winner = lastTrick.leader}
		{@const winnerPlay = [...lastTrick.plays].reverse().find((p) => p.action.type !== 'pass')}
		<div
			data-testid="last-trick"
			class="flex flex-col items-center gap-1 rounded-xl border border-emerald-800/40 bg-emerald-900/30 px-3 py-2"
		>
			<span class="text-xs text-emerald-300/80">
				Last trick — {SEAT_NAMES[winner]} won with
				{winnerPlay ? describeMove(winnerPlay.action) : 'pass'}
			</span>
			<div class="flex">
				{#each playedCards(lastTrick) as card, i (card.rank * 4 + card.suit)}
					<span
						class="mini-card {card.suit >= 2 ? 'text-red-600' : 'text-neutral-900'} {i > 0 ? '-ml-3' : ''}"
					>
						{label(card)}
					</span>
				{/each}
			</div>
		</div>
	{/if}
</div>

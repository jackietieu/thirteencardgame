<script lang="ts">
	import { cardLabel, describeMove, type Card, type Trick, type TrickPlay } from '@thirteen/engine';
	import { game } from '$lib/game.svelte';

	interface Props {
		trick: Trick;
		lastTrick: Trick | null;
	}

	let { trick, lastTrick }: Props = $props();

	/** Grid slot per seat: 0 bottom, 1 left, 2 top, 3 right — plus-sign around the center. */
	const SLOT_CLASS: Record<number, string> = {
		0: 'col-start-2 row-start-3',
		1: 'col-start-1 row-start-2',
		2: 'col-start-2 row-start-1',
		3: 'col-start-3 row-start-2'
	};

	/** Each seat's most recent action in this trick (a seat may play again after beats). */
	const latestBySeat = $derived.by(() => {
		const map = new Map<number, TrickPlay>();
		for (const play of trick.plays) map.set(play.seat, play);
		return map;
	});

	function label(card: Card): string {
		return cardLabel(card);
	}

	function playedCards(t: Trick): Card[] {
		return t.plays.filter((p) => p.action.type !== 'pass').flatMap((p) => p.action.cards);
	}
</script>

<div
	data-testid="trick-pile"
	class="grid min-h-64 w-full grid-cols-[1fr_auto_1fr] grid-rows-[1fr_auto_1fr] items-center justify-items-center gap-1 rounded-2xl border border-emerald-800/50 bg-emerald-950/40 p-3"
>
	{#if trick.plays.length === 0}
		<div class="col-start-2 row-start-2 flex flex-col items-center gap-2">
			<p class="text-sm text-emerald-300/70">
				{lastTrick ? 'New trick' : 'Opening lead'} — {game.seatNames[trick.leader]} leads
			</p>
			{#if lastTrick && lastTrick.plays.length > 0}
				{@const winner = lastTrick.leader}
				{@const winnerPlay = [...lastTrick.plays].reverse().find((p) => p.action.type !== 'pass')}
				<div
					data-testid="last-trick"
					class="flex flex-col items-center gap-1 rounded-xl border border-emerald-800/40 bg-emerald-900/30 px-3 py-2"
				>
					<span class="text-xs text-emerald-300/80">
						Last trick — {game.seatNames[winner]} won with
						{winnerPlay ? describeMove(winnerPlay.action) : 'pass'}
					</span>
					<div class="flex">
						{#each playedCards(lastTrick) as card, i (card.rank * 4 + card.suit)}
							<span
								class="mini-card {card.suit >= 2 ? 'text-red-600' : 'text-neutral-900'} {i > 0
									? '-ml-3'
									: ''}"
							>
								{label(card)}
							</span>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{:else}
		{#each [2, 1, 3, 0] as seat (seat)}
			{@const play = latestBySeat.get(seat)}
			{#if play}
				<div
					data-testid={`trick-play-${seat}`}
					class="flex flex-col items-center gap-1 {SLOT_CLASS[seat]}"
				>
					<span class="text-xs font-semibold text-emerald-200">{game.seatNames[seat]}</span>
					{#if play.action.type === 'pass'}
						<span
							class="rounded-lg border border-emerald-800/60 px-2 py-1 text-xs text-emerald-400/80 italic"
						>
							pass
						</span>
					{:else}
						{@const action = play.action}
						<div class="flex">
							{#each action.cards as card, i (card.rank * 4 + card.suit)}
								<span
									class="mini-card {card.suit >= 2 ? 'text-red-600' : 'text-neutral-900'} {i > 0
										? '-ml-3'
										: ''}"
								>
									{label(card)}
								</span>
							{/each}
						</div>
						<span class="text-[11px] text-emerald-300/80">{describeMove(action)}</span>
					{/if}
				</div>
			{/if}
		{/each}
	{/if}
</div>

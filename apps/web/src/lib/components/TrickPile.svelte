<script lang="ts">
	import { describeMove, type Card, type Trick } from '@thirteen/engine';
	import CardView from './Card.svelte';

	interface Props {
		trick: Trick;
		lastTrick: Trick | null;
		names: string[];
		/** Dealing animation in progress — the pile stays empty until all 52 cards are out. */
		dealing?: boolean;
	}

	let { trick, lastTrick, names, dealing = false }: Props = $props();

	/** Deterministic scatter so each play peeks out from under the newest one. */
	const PILE_JITTER: readonly { x: number; y: number; r: number }[] = [
		{ x: -18, y: -12, r: 3.0 },
		{ x: 16, y: -6, r: -2.4 },
		{ x: -10, y: 14, r: -1.6 },
		{ x: 18, y: 10, r: 3.2 },
		{ x: -22, y: 6, r: 1.8 },
		{ x: 8, y: -16, r: -2.8 }
	];

	/** Card plays in order; passes render as chips instead of card groups. */
	const cardPlays = $derived(
		trick.plays.map((p, i) => ({ play: p, i })).filter((x) => x.play.action.type !== 'pass')
	);
	const passes = $derived(trick.plays.filter((p) => p.action.type === 'pass'));

	/** The play that currently defines the requirement (latest non-pass). */
	const winningIndex = $derived.by(() => {
		for (let i = trick.plays.length - 1; i >= 0; i--) {
			if (trick.plays[i]!.action.type !== 'pass') return i;
		}
		return -1;
	});

	/** Retrigger key for the bomb flash: plays.length when the newest play is a bomb. */
	const bombKey = $derived.by(() => {
		const last = trick.plays[trick.plays.length - 1];
		if (!last || last.action.type === 'pass') return 0;
		return last.action.type === 'fourofakind' || last.action.type === 'doublesequence'
			? trick.plays.length
			: 0;
	});

	function playedCards(t: Trick): Card[] {
		return t.plays.filter((p) => p.action.type !== 'pass').flatMap((p) => p.action.cards);
	}

	// Sweep ghost: when the trick clears, the winning group slides to the winner.
	let lastSeen = $state<{ seat: number; cards: Card[] } | null>(null);
	let sweep = $state<{ seat: number; cards: Card[] } | null>(null);
	$effect(() => {
		const plays = trick.plays;
		if (plays.length > 0) {
			const win = [...plays].reverse().find((p) => p.action.type !== 'pass');
			if (win && win.action.type !== 'pass') lastSeen = { seat: win.seat, cards: win.action.cards };
			if (sweep) sweep = null;
			return;
		}
		if (lastSeen && !sweep && !dealing) {
			sweep = lastSeen;
			lastSeen = null;
			const t = setTimeout(() => (sweep = null), 600);
			return () => clearTimeout(t);
		}
	});
</script>

<div data-testid="trick-pile" class="absolute inset-0">
	{#key bombKey}
		{#if bombKey > 0}
			<div class="bomb-flash"></div>
		{/if}
	{/key}

	{#if sweep}
		<div class="play-pos" style="z-index: 40">
			<div class="play-group sweep-{sweep.seat}">
				<div class="group-cards">
					{#each sweep.cards as card (card.rank * 4 + card.suit)}
						<CardView {card} size="table" />
					{/each}
				</div>
			</div>
		</div>
	{/if}

		{#if dealing}
			<!-- Dealing: the deal overlay owns the center — render nothing here. -->
		{:else if trick.plays.length === 0}
			<div class="empty-state">
			<p class="lead-line">
				{lastTrick ? 'New trick' : 'Opening lead'} — {names[trick.leader]} leads
			</p>
			{#if lastTrick && lastTrick.plays.length > 0}
				{@const winner = lastTrick.leader}
				{@const winnerPlay = [...lastTrick.plays].reverse().find((p) => p.action.type !== 'pass')}
				<div data-testid="last-trick" class="last-trick">
					<span class="last-line">Last trick — {names[winner]} won with {winnerPlay ? describeMove(winnerPlay.action) : 'pass'}</span>
					<div class="last-cards">
						{#each playedCards(lastTrick) as card (card.rank * 4 + card.suit)}
							<CardView {card} size="mini" />
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{:else}
		{#each cardPlays as { play, i } (i)}
			{@const winning = i === winningIndex}
			{@const j = PILE_JITTER[i % PILE_JITTER.length]!}
			<div
				data-testid="trick-play-{i}"
				class="play-pos"
				style="z-index: {winning ? 30 : 10 + i}"
			>
				<div
					class="play-group enter-{play.seat} {winning ? '' : 'group-beaten'}"
					style="transform: translate({j.x}px, {j.y}px) rotate({j.r}deg) scale({winning
						? 1
						: 0.96})"
				>
					<span class="group-name {winning ? 'name-win' : 'ghost'}">{names[play.seat]}</span>
					<div class="group-cards {winning ? 'ring-win' : ''}">
						{#each play.action.cards as card (card.rank * 4 + card.suit)}
							<CardView {card} size="table" />
						{/each}
					</div>
					<span class="group-caption {winning ? '' : 'ghost'}"
						>{winning ? describeMove(play.action) : ''}</span
					>
				</div>
			</div>
		{/each}
		{#if passes.length > 0}
			<div class="pass-row">
				{#each passes as play (play.seat)}
					<span class="pass-chip enter-{play.seat}">{names[play.seat]} passed</span>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.play-pos {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
	}
	.empty-state {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
	}
	.lead-line {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-ink-muted);
	}
	.last-trick {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		background: color-mix(in oklab, var(--color-felt-deep) 72%, transparent);
		border: 1px solid var(--color-hairline);
		border-radius: 0.9rem;
		padding: 0.5rem 0.9rem;
	}
	.last-line {
		font-size: 0.6875rem;
		color: var(--color-ink-muted);
	}
	.last-cards {
		display: flex;
	}
	.last-cards :global(.card-mini + .card-mini) {
		margin-left: -0.75rem;
	}

	.play-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
	}
	.group-cards {
		display: flex;
		border-radius: 0.6rem;
	}
	.group-cards :global(.card-face + .card-face) {
		/* Fixed card-width overlap: %-margins against a shrink-to-fit flex
		   container are circular and leave dead space inside the win ring. */
		margin-left: calc(var(--table-card-w) * -0.3);
	}
	.ring-win {
		box-shadow:
			0 0 0 2px var(--color-gold),
			var(--shadow-card-lift);
	}
	.group-beaten {
		opacity: 0.55;
		filter: brightness(0.85);
	}
	/* Reserved label slots on buried plays: space stays aligned, ink hidden. */
	.ghost {
		visibility: hidden;
	}
	.pass-row {
		position: absolute;
		left: 50%;
		bottom: 3%;
		transform: translateX(-50%);
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.35rem;
		z-index: 35;
	}
	.group-name {
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--color-ink-muted);
	}
	.name-win {
		color: var(--color-gold);
	}
	.group-caption {
		font-size: 0.6875rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		font-weight: 700;
		color: var(--color-gold);
	}
	.pass-chip {
		display: inline-block;
		font-size: 0.6875rem;
		font-style: italic;
		font-weight: 600;
		color: var(--color-gold);
		background: color-mix(in oklab, var(--color-felt-deep) 72%, transparent);
		border: 1px solid var(--color-hairline);
		border-radius: 999px;
		padding: 0.15rem 0.6rem;
		white-space: nowrap;
	}
</style>

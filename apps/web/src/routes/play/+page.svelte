<script lang="ts">
	import { onMount } from 'svelte';
	import {
		canPass as engineCanPass,
		classify,
		currentRequirement,
		describeMove,
		validateMove,
		type Card,
		type Move
	} from '@thirteen/engine';
	import { DEAL_INTERVAL_FAST_MS, DEAL_INTERVAL_MS, game } from '$lib/game.svelte';
	import { cardKey, participatingCards } from '$lib/highlight';
	import ActionBar from '$lib/components/ActionBar.svelte';
	import Hand from '$lib/components/Hand.svelte';
	import LogDrawer from '$lib/components/LogDrawer.svelte';
	import Scoreboard from '$lib/components/Scoreboard.svelte';
	import Seat from '$lib/components/Seat.svelte';
	import TrickPile from '$lib/components/TrickPile.svelte';
	import TurnBanner from '$lib/components/TurnBanner.svelte';

	let selected = $state<Set<string>>(new Set());

	onMount(() => {
		if (!game.state) game.newGame();
	});

	// Clear the selection whenever a new trick or hand starts.
	let lastTrickSig = '';
	$effect(() => {
		const state = game.state;
		const sig = state ? `${state.handNumber}:${state.trick.leader}:${state.trick.plays.length}` : '';
		if (sig !== lastTrickSig) {
			lastTrickSig = sig;
			selected = new Set();
		}
	});

	// Auto-pass: when enabled, stuck turns pass themselves after a beat.
	$effect(() => {
		if (game.myTurn && game.autoPass && game.legal.length === 0 && !game.dealing && !game.dealingPending) {
			const t = setTimeout(() => game.pass(), 500);
			return () => clearTimeout(t);
		}
	});

	const hand = $derived<Card[]>(game.state?.players[0]?.hand ?? []);
	const highlighted = $derived<Set<string>>(
		game.state && game.myTurn && !game.dealing && !game.dealingPending
			? participatingCards(game.state, 0)
			: new Set<string>()
	);
	const selectionCards = $derived(hand.filter((c) => selected.has(cardKey(c))));
	const selectedMove = $derived<Move | null>(
		selectionCards.length > 0 ? classify(selectionCards) : null
	);
	const requirement = $derived(game.state ? currentRequirement(game.state) : null);
	const interacting = $derived(!game.dealing && !game.dealingPending);

	const canPlay = $derived(
		game.myTurn &&
			interacting &&
			selectedMove !== null &&
			game.state !== null &&
			validateMove(game.state, 0, selectedMove) === null
	);
	const canPass = $derived(
		game.state !== null && engineCanPass(game.state, 0) && interacting
	);

	const reason = $derived.by(() => {
		if (!game.myTurn || selected.size === 0) return null;
		if (selectedMove === null) return 'That selection is not a valid combination.';
		const error = game.state ? validateMove(game.state, 0, selectedMove) : 'not_your_turn';
		switch (error) {
			case null:
				return null;
			case 'invalid_combo':
				return 'That selection is not a valid combination.';
			case 'does_not_beat':
				return requirement
					? `That doesn't beat ${describeMove(requirement)}.`
					: "That doesn't beat the current play.";
			case 'opening_requires_3spades':
				return 'The first play of the game must include the 3♠.';
			case 'already_passed':
				return 'You already passed this trick.';
			default:
				return 'You cannot play that right now.';
		}
	});

	/** Cards shown at each seat: grows during the dealing animation, real count otherwise. */
	const seatCardCounts = $derived.by(() => {
		const state = game.state;
		if (!state) return [0, 0, 0, 0];
		return [0, 1, 2, 3].map((seat) => {
			if (game.dealing) {
				return Math.min(13, Math.max(0, Math.ceil((game.dealProgress - seat) / 4)));
			}
			if (game.dealingPending) return 0;
			return state.players[seat]?.hand.length ?? 0;
		});
	});

	const dealInterval = $derived(game.fast ? DEAL_INTERVAL_FAST_MS : DEAL_INTERVAL_MS);

	function toggleCard(card: Card) {
		const key = cardKey(card);
		const next = new Set(selected);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		selected = next;
	}

	function onPlay() {
		if (!game.myTurn || !interacting) return;
		if (selectedMove === null) {
			if (selected.size > 0) {
				game.lastError = 'invalid_combo';
				game.shake++;
			}
			return;
		}
		game.play(selectedMove);
		selected = new Set();
	}

	function onPass() {
		if (!interacting) return;
		game.pass();
		selected = new Set();
	}

	function onKeydown(event: KeyboardEvent) {
		const target = event.target;
		if (target instanceof HTMLInputElement && target.type !== 'checkbox' && event.key !== 'Enter') {
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			onPlay();
		} else if (event.key === 'p' || event.key === 'P') {
			if (canPass) {
				event.preventDefault();
				onPass();
			}
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
	<title>Play — Thirteen</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-5xl flex-col gap-3 p-2 sm:p-4">
	<header class="flex items-center justify-between gap-3">
		<h1 class="text-lg font-bold tracking-tight">Thirteen</h1>
		<div class="flex items-center gap-2 text-sm">
			<a href="/" class="text-emerald-300 underline-offset-2 hover:underline">Home</a>
			<a href="/rules" class="text-emerald-300 underline-offset-2 hover:underline">Rules</a>
			<button
				type="button"
				class="rounded-lg border border-emerald-700/60 px-3 py-1 font-semibold text-emerald-100 transition hover:bg-emerald-900/50"
				onclick={() => {
					selected = new Set();
					game.newGame();
				}}
			>
				New game
			</button>
		</div>
	</header>

	{#if game.state}
		<Scoreboard
			scores={game.state.scores}
			finished={game.state.finished}
			handNumber={game.state.handNumber}
			phase={game.state.phase}
			winner={game.state.winner}
			names={game.seatNames}
			onNextHand={() => game.nextHand()}
		/>

		{#if game.state.phase === 'gameOver'}
			<section
				class="rounded-2xl border border-amber-400/60 bg-emerald-900/60 p-6 text-center"
				data-testid="game-over-panel"
			>
				<h2 class="text-2xl font-bold text-amber-300">
					Game over — {game.seatNames[game.state.winner ?? 0]} wins!
				</h2>
				<p class="mt-1 text-sm text-emerald-200">
					Final scores — {game.seatNames.map((name, seat) => `${name}: ${game.state?.scores[seat] ?? 0}`).join(' · ')}
				</p>
			</section>
		{/if}

		<div class="relative flex flex-col items-center gap-3">
			<Seat
				name={game.seatNames[2]}
				position="top"
				cardCount={seatCardCounts[2]}
				isTurn={game.state.turn === 2 && game.state.phase === 'playing' && interacting}
				passed={game.state.players[2]?.passed ?? false}
				out={game.state.players[2]?.out ?? false}
			/>

			<div class="flex w-full items-start justify-between gap-2">
				<Seat
					name={game.seatNames[1]}
					position="left"
					cardCount={seatCardCounts[1]}
					isTurn={game.state.turn === 1 && game.state.phase === 'playing' && interacting}
					passed={game.state.players[1]?.passed ?? false}
					out={game.state.players[1]?.out ?? false}
				/>

				<div class="flex min-w-0 flex-1 flex-col items-center gap-3">
					<TrickPile trick={game.state.trick} lastTrick={game.state.lastTrick} />
					<TurnBanner state={game.state} />
				</div>

				<Seat
					name={game.seatNames[3]}
					position="right"
					cardCount={seatCardCounts[3]}
					isTurn={game.state.turn === 3 && game.state.phase === 'playing' && interacting}
					passed={game.state.players[3]?.passed ?? false}
					out={game.state.players[3]?.out ?? false}
				/>
			</div>

			{#if game.dealingPending}
				<div class="flex flex-col items-center gap-2 py-6" data-testid="deal-panel">
					<p class="text-sm text-emerald-200">52 cards ready — deal them out one by one.</p>
					<button
						type="button"
						data-testid="deal-button"
						class="rounded-xl bg-emerald-500 px-8 py-3 text-lg font-semibold text-emerald-950 shadow-lg transition hover:bg-emerald-400"
						onclick={() => game.startDealing()}
					>
						Deal cards
					</button>
				</div>
			{:else if game.dealing}
				<p class="py-6 text-center text-sm text-emerald-300" data-testid="dealing-status">
					Dealing… {game.dealProgress}/52
				</p>
			{:else if game.state.phase === 'playing'}
				<ActionBar
					canPlay={canPlay}
					canPass={canPass}
					{reason}
					autoPass={game.autoPass}
					onPlay={onPlay}
					onPass={onPass}
					onToggleAutoPass={(value) => (game.autoPass = value)}
					shakeKey={game.shake}
				/>

				<Hand
					cards={hand}
					selected={selected}
					onToggle={toggleCard}
					myTurn={game.myTurn}
					highlighted={highlighted}
					disabled={!game.myTurn}
				/>
			{:else}
				<p class="py-4 text-center text-sm text-emerald-200">
					{game.state.phase === 'handOver'
						? 'Hand over — start the next hand from the scoreboard.'
						: 'The game has ended. Start a new game from the scoreboard.'}
				</p>
			{/if}

			<LogDrawer log={game.log} />

			{#if game.dealing}
				<div class="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
					{#each Array(52) as _, i (i)}
						<span
							class="deal-card card-back deal-{['bottom', 'left', 'top', 'right'][i % 4]}"
							style="animation-delay: {i * dealInterval}ms"
						></span>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<p class="py-16 text-center text-emerald-300">Dealing…</p>
	{/if}
</main>

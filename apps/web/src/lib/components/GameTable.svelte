<script lang="ts">
	import {
		canPass as engineCanPass,
		classify,
		currentRequirement,
		describeMove,
		validateMove,
		type Card,
		type Move
	} from '@thirteen/engine';
	import { DEAL_INTERVAL_FAST_MS, DEAL_INTERVAL_MS } from '$lib/game.svelte';
	import type { GameDriver } from '$lib/driver';
	import { cardKey, participatingCards } from '$lib/highlight';
	import ActionBar from '$lib/components/ActionBar.svelte';
	import Hand from '$lib/components/Hand.svelte';
	import LogDrawer from '$lib/components/LogDrawer.svelte';
	import Scoreboard from '$lib/components/Scoreboard.svelte';
	import Seat from '$lib/components/Seat.svelte';
	import TrickPile from '$lib/components/TrickPile.svelte';
	import TurnBanner from '$lib/components/TurnBanner.svelte';

	interface Props {
		store: GameDriver;
	}

	let { store }: Props = $props();

	let selected = $state<Set<string>>(new Set());

	// Clear the selection whenever a new trick or hand starts.
	let lastTrickSig = '';
	$effect(() => {
		const state = store.state;
		const sig = state ? `${state.handNumber}:${state.trick.leader}:${state.trick.plays.length}` : '';
		if (sig !== lastTrickSig) {
			lastTrickSig = sig;
			selected = new Set();
		}
	});

	// Auto-pass: when enabled, stuck turns pass themselves after a beat.
	$effect(() => {
		if (store.myTurn && store.autoPass && store.legal.length === 0 && !store.dealing && !store.dealingPending) {
			const t = setTimeout(() => store.pass(), 500);
			return () => clearTimeout(t);
		}
	});

	const hand = $derived<Card[]>(store.state?.players[0]?.hand ?? []);
	const highlighted = $derived<Set<string>>(
		store.state && store.myTurn && !store.dealing && !store.dealingPending
			? participatingCards(store.state, 0)
			: new Set<string>()
	);
	const selectionCards = $derived(hand.filter((c) => selected.has(cardKey(c))));
	const selectedMove = $derived<Move | null>(
		selectionCards.length > 0 ? classify(selectionCards) : null
	);
	const requirement = $derived(store.state ? currentRequirement(store.state) : null);
	const interacting = $derived(!store.dealing && !store.dealingPending);

	const canPlay = $derived(
		store.myTurn &&
			interacting &&
			selectedMove !== null &&
			store.state !== null &&
			validateMove(store.state, 0, selectedMove) === null
	);
	const canPass = $derived(store.state !== null && engineCanPass(store.state, 0) && interacting);

	const reason = $derived.by(() => {
		if (!store.myTurn || selected.size === 0) return null;
		if (selectedMove === null) return 'That selection is not a valid combination.';
		const error = store.state ? validateMove(store.state, 0, selectedMove) : 'not_your_turn';
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
		const state = store.state;
		if (!state) return [0, 0, 0, 0];
		return [0, 1, 2, 3].map((seat) => {
			if (store.dealing) {
				return Math.min(13, Math.max(0, Math.ceil((store.dealProgress - seat) / 4)));
			}
			if (store.dealingPending) return 0;
			const p = state.players[seat];
			if (!p) return 0;
			return p.hand.length > 0 ? p.hand.length : Number((p as { handCount?: number }).handCount ?? 0);
		});
	});

	const dealInterval = $derived(store.fast ? DEAL_INTERVAL_FAST_MS : DEAL_INTERVAL_MS);

	let tableEl: HTMLDivElement | undefined = $state();
	let handAreaEl: HTMLDivElement | undefined = $state();
	let dealTargets = $state<{ dx: number; dy: number }[]>([]);

	// Measure real destinations when a deal starts: bots' cards fly to their seat
	// hand; the human's cards fly to their exact final hand slot positions.
	$effect(() => {
		if (!store.dealing) {
			if (dealTargets.length > 0) dealTargets = [];
			return;
		}
		if (dealTargets.length === 52 || !tableEl) return;
		const w = tableEl.getBoundingClientRect();
		const cx = w.left + w.width / 2;
		const cy = w.top + w.height / 2;
		const targets: { dx: number; dy: number }[] = [];
		for (let i = 0; i < 52; i++) {
			const seat = i % 4;
			if (seat === 0) {
				const hr = handAreaEl?.getBoundingClientRect();
				if (hr && hr.width > 0) {
					const j = i / 4;
					const tx = hr.left + ((j + 0.5) * hr.width) / 13;
					const ty = hr.top + hr.height / 2;
					targets.push({ dx: tx - cx, dy: ty - cy });
				} else {
					targets.push({ dx: 0, dy: w.height / 2 - 30 });
				}
			} else {
				const el = document.querySelector(`[data-seat="${CSS.escape(store.seatNames[seat])}"]`);
				if (el) {
					const r = el.getBoundingClientRect();
					targets.push({ dx: r.left + r.width / 2 - cx, dy: r.top + r.height / 2 - cy });
				} else {
					targets.push({ dx: 0, dy: -w.height / 3 });
				}
			}
		}
		dealTargets = targets;
	});

	function toggleCard(card: Card) {
		const key = cardKey(card);
		const next = new Set(selected);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		selected = next;
	}

	function onPlay() {
		if (!store.myTurn || !interacting) return;
		if (selectedMove === null) {
			if (selected.size > 0) {
				store.lastError = 'invalid_combo';
				store.shake++;
			}
			return;
		}
		store.play(selectedMove);
		selected = new Set();
	}

	function onPass() {
		if (!interacting) return;
		store.pass();
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

{#if store.state}
	<Scoreboard
		scores={store.state.scores}
		finished={store.state.finished}
		handNumber={store.state.handNumber}
		phase={store.state.phase}
		winner={store.state.winner}
		names={store.seatNames}
		onNextHand={() => store.nextHand()}
	/>

	{#if store.state.phase === 'gameOver'}
		<section
			class="rounded-2xl border border-amber-400/60 bg-emerald-900/60 p-6 text-center"
			data-testid="game-over-panel"
		>
			<h2 class="text-2xl font-bold text-amber-300">
				Game over — {store.seatNames[store.state.winner ?? 0]} wins!
			</h2>
			<p class="mt-1 text-sm text-emerald-200">
				Final scores — {store.seatNames.map((name, seat) => `${name}: ${store.state?.scores[seat] ?? 0}`).join(' · ')}
			</p>
		</section>
	{/if}

	<div class="relative flex flex-col items-center gap-3" bind:this={tableEl}>
		<Seat
			name={store.seatNames[2]}
			position="top"
			cardCount={seatCardCounts[2]}
			isTurn={store.state.turn === 2 && store.state.phase === 'playing' && interacting}
			passed={store.state.players[2]?.passed ?? false}
			out={store.state.players[2]?.out ?? false}
		/>

		<div class="flex w-full items-start justify-between gap-2">
			<Seat
				name={store.seatNames[1]}
				position="left"
				cardCount={seatCardCounts[1]}
				isTurn={store.state.turn === 1 && store.state.phase === 'playing' && interacting}
				passed={store.state.players[1]?.passed ?? false}
				out={store.state.players[1]?.out ?? false}
			/>

			<div class="flex min-w-0 flex-1 flex-col items-center gap-3">
				<TrickPile trick={store.state.trick} lastTrick={store.state.lastTrick} names={store.seatNames} />
				<TurnBanner state={store.state} names={store.seatNames} />
			</div>

			<Seat
				name={store.seatNames[3]}
				position="right"
				cardCount={seatCardCounts[3]}
				isTurn={store.state.turn === 3 && store.state.phase === 'playing' && interacting}
				passed={store.state.players[3]?.passed ?? false}
				out={store.state.players[3]?.out ?? false}
			/>
		</div>

		{#if store.dealingPending}
			<div class="flex flex-col items-center gap-2 py-6" data-testid="deal-panel">
				<button
					type="button"
					data-testid="deal-button"
					class="rounded-xl bg-emerald-500 px-8 py-3 text-lg font-semibold text-emerald-950 shadow-lg transition hover:bg-emerald-400"
					onclick={() => store.startDealing()}
				>
					Deal cards
				</button>
			</div>
		{:else if store.state.phase === 'playing'}
			<div class={store.dealing ? 'invisible' : ''} bind:this={handAreaEl}>
				<div class="mb-8">
					<ActionBar
						canPlay={canPlay}
						canPass={canPass}
						{reason}
						autoPass={store.autoPass}
						onPlay={onPlay}
						onPass={onPass}
						onToggleAutoPass={(value) => (store.autoPass = value)}
						shakeKey={store.shake}
					/>
				</div>

				<Hand
					cards={hand}
					selected={selected}
					onToggle={toggleCard}
					myTurn={store.myTurn}
					highlighted={highlighted}
					disabled={!store.myTurn}
				/>
			</div>
		{:else}
			<p class="py-4 text-center text-sm text-emerald-200">
				{store.state.phase === 'handOver'
					? 'Hand over — start the next hand from the scoreboard.'
					: 'The game has ended. Start a new game from the scoreboard.'}
			</p>
		{/if}

		<LogDrawer log={store.log} names={store.seatNames} />

		{#if store.dealing && dealTargets.length === 52}
			<div class="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
				<p class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-emerald-300">
					Dealing… {store.dealProgress}/52
				</p>
				{#each dealTargets as target, i (i)}
					<span
						class="deal-card card-back"
						style="--dx: {target.dx}px; --dy: {target.dy}px; animation-delay: {i * dealInterval}ms"
					></span>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<p class="py-16 text-center text-emerald-300">Dealing…</p>
{/if}
<div class="rotate-overlay" aria-hidden="true">
	<svg viewBox="0 0 24 24" class="rotate-icon"><path d="M17 1H7c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 18H7V5h10v14z" fill="currentColor" /></svg>
	<p>Please rotate your device to landscape to play.</p>
</div>

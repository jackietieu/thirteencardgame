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
	import type { Snippet } from 'svelte';
	import { DEAL_INTERVAL_FAST_MS, DEAL_INTERVAL_MS } from '$lib/game.svelte';
	import type { GameDriver } from '$lib/driver';
	import { cardKey, participatingCards } from '$lib/highlight';
	import ActionBar from '$lib/components/ActionBar.svelte';
	import CardBack from '$lib/components/CardBack.svelte';
	import Felt from '$lib/components/Felt.svelte';
	import Hand from '$lib/components/Hand.svelte';
	import LogDrawer from '$lib/components/LogDrawer.svelte';
	import PlacingsPanel from '$lib/components/PlacingsPanel.svelte';
	import Rail from '$lib/components/Rail.svelte';
	import Seat from '$lib/components/Seat.svelte';
	import TrickPile from '$lib/components/TrickPile.svelte';
	import TurnBanner from '$lib/components/TurnBanner.svelte';

	interface Props {
		store: GameDriver;
		nav?: Snippet;
	}

	let { store, nav }: Props = $props();

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

	const summary = $derived.by(() => {
		if (selected.size === 0) return null;
		if (selectedMove === null) return 'Not a valid combination';
		return describeMove(selectedMove);
	});

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
	// pod; the human's cards fly to each card's actual slot in the fan.
	$effect(() => {
		if (!store.dealing) {
			if (dealTargets.length > 0) dealTargets = [];
			return;
		}
		if (dealTargets.length === 52 || !tableEl) return;
		const w = tableEl.getBoundingClientRect();
		const cx = w.left + w.width / 2;
		const cy = w.top + w.height / 2;
		const handCards = handAreaEl?.querySelectorAll('.play-card') ?? [];
		const targets: { dx: number; dy: number }[] = [];
		for (let i = 0; i < 52; i++) {
			const seat = i % 4;
			if (seat === 0) {
				const el = handCards[i / 4];
				if (el) {
					const r = el.getBoundingClientRect();
					targets.push({ dx: r.left + r.width / 2 - cx, dy: r.top + r.height / 2 - cy });
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
		if (target instanceof HTMLInputElement && target.type !== 'checkbox') {
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

{#snippet railRight()}
	{@render nav?.()}
	<LogDrawer log={store.log} names={store.seatNames} />
{/snippet}

<svelte:window onkeydown={onKeydown} />

{#if store.state}
	<div class="shell">
		<Rail
			scores={store.state.scores}
			names={store.seatNames}
			finished={store.state.finished}
			handNumber={store.state.handNumber}
			phase={store.state.phase}
			winner={store.state.winner}
			turn={store.state.turn}
			nav={railRight}
		/>

		<div class="table" bind:this={tableEl}>
			<Felt />

			<Seat
				name={store.seatNames[2]}
				position="top"
				cardCount={seatCardCounts[2]}
				isTurn={store.state.turn === 2 && store.state.phase === 'playing' && interacting}
				passed={store.state.players[2]?.passed ?? false}
				out={store.state.players[2]?.out ?? false}
			/>
			<Seat
				name={store.seatNames[1]}
				position="left"
				cardCount={seatCardCounts[1]}
				isTurn={store.state.turn === 1 && store.state.phase === 'playing' && interacting}
				passed={store.state.players[1]?.passed ?? false}
				out={store.state.players[1]?.out ?? false}
			/>
			<Seat
				name={store.seatNames[3]}
				position="right"
				cardCount={seatCardCounts[3]}
				isTurn={store.state.turn === 3 && store.state.phase === 'playing' && interacting}
				passed={store.state.players[3]?.passed ?? false}
				out={store.state.players[3]?.out ?? false}
			/>

			<div class="play-zone">
				{#if store.dealingPending}
					<div class="deal-panel" data-testid="deal-panel">
						<button
							type="button"
							data-testid="deal-button"
							class="btn-primary"
							onclick={() => store.startDealing()}
						>
							Deal cards
						</button>
					</div>
				{:else}
					<TrickPile
						trick={store.state.trick}
						lastTrick={store.state.lastTrick}
						names={store.seatNames}
						dealing={store.dealing}
					/>
				{/if}
			</div>

			{#if store.dealing && dealTargets.length === 52}
				<div class="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
					<p class="deal-label">Dealing… {store.dealProgress}/52</p>
					{#each dealTargets as target, i (i)}
						<CardBack
							class="deal-card"
							style="position: absolute; left: 50%; top: 50%; --dx: {target.dx}px; --dy: {target.dy}px; animation-delay: {i *
								dealInterval}ms; --back-w: 2.1rem"
						/>
					{/each}
				</div>
			{/if}
		</div>

		<div class="dock">
			<div class="dock-prompt">
				<TurnBanner state={store.state} names={store.seatNames} />
			</div>
			<div class="dock-actions">
				{#if store.state.phase === 'playing'}
					<ActionBar
						canPlay={canPlay}
						canPass={canPass}
						{reason}
						{summary}
						autoPass={store.autoPass}
						onPlay={onPlay}
						onPass={onPass}
						onToggleAutoPass={(value) => (store.autoPass = value)}
						shakeKey={store.shake}
					/>
				{/if}
			</div>
			<div class="dock-hand {store.dealing || store.dealingPending ? 'invisible' : ''}" bind:this={handAreaEl}>
				<Hand
					cards={hand}
					selected={selected}
					onToggle={toggleCard}
					myTurn={store.myTurn}
					highlighted={highlighted}
					disabled={!store.myTurn}
				/>
			</div>
		</div>

		<PlacingsPanel
			scores={store.state.scores}
			names={store.seatNames}
			finished={store.state.finished}
			handNumber={store.state.handNumber}
			phase={store.state.phase}
			winner={store.state.winner}
			onNextHand={() => store.nextHand()}
		/>
	</div>
{:else}
	<div class="shell">
		<div class="rail"></div>
		<div class="table">
			<Felt />
			<p class="deal-label">Dealing…</p>
		</div>
		<div class="dock"></div>
	</div>
{/if}

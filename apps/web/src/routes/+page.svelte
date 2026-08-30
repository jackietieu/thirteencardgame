<script lang="ts">
	import type { Card } from '@thirteen/engine';
	import { game } from '$lib/game.svelte';
	import { getName } from '$lib/name';
	import CardView from '$lib/components/Card.svelte';

	// Fresh deal on click, matching the in-game "New game" button. Without a
	// saved name yet, /play's name gate starts the game after collecting it.
	function newGame() {
		if (getName().trim()) game.newGame();
	}
	const HERO_CARDS: Card[] = [
		{ rank: 3, suit: 0 },
		{ rank: 13, suit: 0 },
		{ rank: 14, suit: 2 },
		{ rank: 12, suit: 3 },
		{ rank: 15, suit: 3 }
	];
</script>

<svelte:head>
	<title>Thirteen — Tiến Lên</title>
</svelte:head>

<main class="hero">
	<div class="hero-fan" aria-hidden="true">
		{#each HERO_CARDS as card, i (card.rank * 4 + card.suit)}
			<span
				class="hero-slot"
				style="--rot: {((i - 2) * 7).toFixed(0)}deg; --arc-y: {((i - 2) * (i - 2) * 6).toFixed(0)}px; --z: {i + 1}; animation-delay: {i * 70}ms"
			>
				<CardView {card} disabled />
			</span>
		{/each}
	</div>
	<h1>Thirteen</h1>
	<p class="hero-sub">Tiến Lên — 13 cards, you against three bots.</p>
	<div class="hero-ctas">
		<a href="/play" class="btn-primary" onclick={newGame}>New game vs bots</a>
		<a href="/online" class="btn-ghost">Play online</a>
		<a href="/rules" class="nav-link">Rules</a>
	</div>
</main>

<style>
	.hero {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.25rem;
		text-align: center;
		padding: 2rem 1rem;
		background:
			radial-gradient(90% 70% at 50% 62%, var(--color-felt-deep) 0%, transparent 70%),
			var(--color-bg);
		--card-w: clamp(64px, 13vw, 96px);
	}
	.hero h1 {
		font-family: var(--font-display);
		font-size: clamp(2.5rem, 7vw, 3.5rem);
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--color-ink);
	}
	.hero-sub {
		color: var(--color-ink-muted);
		font-size: 1.05rem;
	}
	.hero-fan {
		display: flex;
		justify-content: center;
		padding-bottom: 1.5rem;
	}
	.hero-slot {
		position: relative;
		display: inline-flex;
		z-index: var(--z, 1);
		transform: translateY(var(--arc-y, 0px)) rotate(var(--rot, 0deg));
		animation: hero-in var(--dur-slow) var(--ease-card) backwards;
	}
	.hero-slot + .hero-slot {
		margin-left: calc(var(--card-w) * -0.42);
	}
	@keyframes hero-in {
		from {
			opacity: 0;
			transform: translateY(calc(var(--arc-y, 0px) + 1.5rem)) rotate(var(--rot, 0deg));
		}
		to {
			opacity: 1;
			transform: translateY(var(--arc-y, 0px)) rotate(var(--rot, 0deg));
		}
	}
	.hero-ctas {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		justify-content: center;
	}
</style>

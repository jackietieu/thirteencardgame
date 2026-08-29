<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from '$lib/game.svelte';
	import GameTable from '$lib/components/GameTable.svelte';

	onMount(() => {
		if (!game.state) game.newGame();
	});
</script>

<svelte:head>
	<title>Play — Thirteen</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-5xl flex-col gap-3 p-2 sm:p-4">
	<header class="flex items-center justify-between gap-3">
		<h1 class="text-lg font-bold tracking-tight">Thirteen</h1>
		<div class="flex items-center gap-2 text-sm">
			<a href="/" class="text-emerald-300 underline-offset-2 hover:underline">Home</a>
			<a href="/rules" class="text-emerald-300 underline-offset-2 hover:underline">Rules</a>
			<a href="/online" class="text-emerald-300 underline-offset-2 hover:underline">Online</a>
			<button
				type="button"
				class="rounded-lg border border-emerald-700/60 px-3 py-1 font-semibold text-emerald-100 transition hover:bg-emerald-900/50"
				onclick={() => game.newGame()}
			>
				New game
			</button>
		</div>
	</header>

	<GameTable store={game} />
</main>

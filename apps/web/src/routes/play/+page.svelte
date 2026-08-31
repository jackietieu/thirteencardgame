<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from '$lib/game.svelte';
	import { getName, setName } from '$lib/name';
	import { t } from '$lib/i18n.svelte';
	import GameTable from '$lib/components/GameTable.svelte';

	let name = $state('');
	/** False until a display name is confirmed — gates starting a local game. */
	let named = $state(false);

	onMount(() => {
		const saved = getName().trim();
		if (!saved) return;
		name = saved;
		named = true;
		if (!game.state) game.newGame();
	});

	function confirmName() {
		const trimmed = name.trim();
		if (!trimmed) return;
		setName(trimmed);
		named = true;
		if (!game.state) game.newGame();
	}
</script>

<svelte:head>
	<title>{t('title.play')}</title>
</svelte:head>

{#if !named && !game.state}
	<main class="name-gate">
		<section class="panel-card" data-testid="name-panel">
			<form class="flex flex-col gap-2" onsubmit={(e) => { e.preventDefault(); confirmName(); }}>
				<label class="field-label" for="player-name">{t('name.label')}</label>
				<input
					id="player-name"
					data-testid="name-input"
					class="field-input"
					placeholder={t('name.placeholder')}
					maxlength="16"
					bind:value={name}
				/>
				<button type="submit" data-testid="name-submit" class="btn-primary">{t('name.start')}</button>
			</form>
		</section>
	</main>
{:else}
	<GameTable store={game}>
		{#snippet nav()}
			<a href="/" class="nav-link">{t('nav.home')}</a>
			<a href="/rules" class="nav-link">{t('nav.rules')}</a>
			<a href="/online" class="nav-link">{t('nav.online')}</a>
			<button type="button" class="btn-ghost btn-sm" onclick={() => game.newGame()}>
				{t('nav.newGame')}
			</button>
		{/snippet}
	</GameTable>
{/if}

<style>
	.name-gate {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding-inline: 0.75rem;
	}
	.panel-card {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		width: min(26rem, calc(100vw - 2rem));
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-panel);
		box-shadow: var(--shadow-pod);
		padding: 1.5rem;
	}
	.field-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-ink-muted);
	}
</style>

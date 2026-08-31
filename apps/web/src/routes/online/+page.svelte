<script lang="ts">
	import { onMount } from 'svelte';
	import { online } from '$lib/online.svelte';
	import LanguagePicker from '$lib/components/LanguagePicker.svelte';
	import { t } from '$lib/i18n.svelte';
	import { getName, setName } from '$lib/name';
	import Avatar from '$lib/components/Avatar.svelte';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import GameTable from '$lib/components/GameTable.svelte';

	let name = $state(getName());
	let joinCode = $state('');
	let createPassword = $state('');
	let joinPassword = $state('');
	let copied = $state(false);
	/** Room code taken from a shared link (/online?room=CODE). */
	let urlRoom = $state('');

	onMount(() => {
		const room = new URLSearchParams(location.search).get('room');
		if (!room) return;
		urlRoom = room.trim().toUpperCase();
		joinCode = urlRoom;
		// Returning player: skip the prompt and join straight away. Newcomers
		// get the name form below, pre-aimed at the linked room.
		if (getName().trim().length > 0) online.join(urlRoom);
	});

	function ensureName(): boolean {
		const trimmed = name.trim();
		if (trimmed.length === 0) return false;
		setName(trimmed);
		return true;
	}

	function create() {
		if (ensureName()) online.create(createPassword.trim() || undefined);
	}

	function join(code?: string) {
		const target = (code ?? joinCode).trim();
		if (!ensureName() || target.length !== 4) return;
		online.join(target, joinPassword.trim() || undefined);
	}

	function shareUrl(): string {
		return typeof location !== 'undefined' ? `${location.origin}/online?room=${online.room}` : '';
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(shareUrl());
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard unavailable (insecure context): the input is selectable.
		}
	}

	const SPADE =
		'M12 2C8.4 6.9 4 9.2 4 13.1a4.1 4.1 0 0 0 7.2 2.7c-.3 2.5-1.4 4-3.2 5.2h8c-1.8-1.2-2.9-2.7-3.2-5.2a4.1 4.1 0 0 0 7.2-2.7C20 9.2 15.6 6.9 12 2z';
</script>

<svelte:head>
	<title>{t('title.online')}</title>
</svelte:head>

{#if online.status === 'playing'}
	<GameTable store={online}>
		{#snippet nav()}
			<a href="/play" class="nav-link">{t('nav.vsBots')}</a>
			<a href="/rules" class="nav-link">{t('nav.rules')}</a>
			{#if online.status !== 'idle'}
				<button type="button" class="btn-ghost btn-sm" onclick={() => online.leave()}>
					{t('lobby.leave')}
				</button>
			{/if}
		{/snippet}
		{#snippet chat()}
			<ChatPanel />
		{/snippet}
	</GameTable>
{:else}
	<main class="lobby">
		<header class="rail lobby-rail">
			<div class="flex items-center gap-2">
				<svg viewBox="0 0 24 24" class="size-5 text-accent" aria-hidden="true"
					><path d={SPADE} fill="currentColor" /></svg
				>
				<span class="rail-word">Thirteen — Online</span>
			</div>
			<div class="ml-auto flex items-center gap-1">
				<a href="/play" class="nav-link">{t('nav.vsBots')}</a>
				<a href="/rules" class="nav-link">{t('nav.rules')}</a>
				{#if online.status !== 'idle'}
					<button type="button" class="btn-ghost btn-sm" onclick={() => online.leave()}>
						{t('lobby.leave')}
					</button>
				{/if}
				<LanguagePicker />
			</div>
		</header>

		<div class="lobby-body">
			{#if online.status === 'idle'}
				<section class="panel-card" data-testid="connect-panel">
					{#if urlRoom}
						<p class="text-center text-sm text-ink-muted">
							{t('lobby.joining')}
							<span class="font-display font-bold tracking-widest text-ink">{urlRoom}</span>
						</p>
					{/if}
					<div class="flex flex-col gap-2">
						<label class="field-label" for="player-name">{t('name.label')}</label>
						<input
							id="player-name"
							data-testid="name-input"
							placeholder={t('name.placeholder')}
							maxlength="16"
							bind:value={name}
						/>
					</div>
					{#if urlRoom}
						{#if online.needsPassword}
							<div class="flex flex-col gap-2">
								<label class="field-label" for="join-password">{t('lobby.password')}</label>
								<input
									id="join-password"
									data-testid="join-password-input"
									type="password"
									placeholder={t('lobby.password.placeholder')}
									maxlength="24"
									bind:value={joinPassword}
								/>
							</div>
						{/if}
						<button
							type="button"
							data-testid="join-button"
							class="btn-primary w-full"
							onclick={() => join(urlRoom)}
						>
							{t('lobby.joinGame')}
						</button>
					{:else}
						<div class="flex flex-col gap-2">
							<label class="field-label" for="create-password"
								>{t('lobby.createPassword')} <span class="font-normal text-ink-subtle">{t('lobby.optional')}</span></label
							>
							<input
								id="create-password"
								data-testid="create-password-input"
								type="password"
								placeholder={t('lobby.createPassword.placeholder')}
								maxlength="24"
								bind:value={createPassword}
							/>
						</div>
						<button
							type="button"
							data-testid="create-room"
							class="btn-primary w-full"
							onclick={create}
						>
							{t('lobby.create')}
						</button>
						<div class="flex items-end gap-2">
							<div class="flex flex-1 flex-col gap-2">
								<label class="field-label" for="room-code">{t('lobby.roomCode')}</label>
								<input
									id="room-code"
									data-testid="room-code-input"
									class="field-input uppercase tracking-widest"
									placeholder="ABCD"
									maxlength="4"
									bind:value={joinCode}
								/>
							</div>
							<button
								type="button"
								data-testid="join-button"
								class="btn-ghost"
								onclick={() => join()}
							>
								{t('lobby.join')}
							</button>
						</div>
					{/if}
					{#if online.lastError}
						<p class="text-center text-sm text-danger" data-testid="connect-error">
							{online.lastError === 'room_not_found'
								? t('err.room_not_found')
								: online.lastError === 'room_full'
								? t('err.room_full')
								: online.lastError === 'bad_password'
									? t('err.bad_password')
									: online.lastError === 'kicked'
										? t('err.kicked')
										: online.lastError}
						</p>
					{/if}
				</section>
			{:else if online.status === 'lobby' || online.status === 'connecting' || online.status === 'reconnecting'}
				<section class="panel-card items-center" data-testid="room-panel">
					<p class="text-sm text-ink-muted">{t('lobby.roomCode')}</p>
					<p
						class="font-display text-4xl font-bold tracking-[0.3em] text-ink"
						data-testid="room-code"
					>
						{online.room}
					</p>
					{#if online.status === 'lobby'}
						<div class="flex w-full items-center gap-2">
							<input
								readonly
								data-testid="share-link"
								class="field-input min-w-0 flex-1 text-xs"
								value={shareUrl()}
								onfocus={(e) => e.currentTarget.select()}
							/>
							<button
								type="button"
								data-testid="share-copy"
								class="btn-ghost btn-sm shrink-0"
								onclick={copyLink}
							>
								{copied ? t('lobby.copied') : t('lobby.copy')}
							</button>
						</div>
					{/if}
					<ul class="flex w-full flex-col gap-1 text-sm text-ink-muted">
						{#each online.lobbyPlayers as player, i (i)}
							<li
								class="flex items-center justify-between rounded-lg px-2 py-1.5 {i === online.mySeat
									? 'bg-surface-raised'
									: ''}"
							>
								<span class="flex items-center gap-2">
									{#if player !== ''}
										<Avatar name={player} />
									{/if}
									{player === '' ? t('lobby.emptySeat') : player}
									{#if player === ''}<span class="text-xs text-ink-subtle">{t('lobby.botWillFill')}</span>{/if}
									{i === online.mySeat ? ` ${t('lobby.you')}` : ''}
								</span>
								{#if online.lobbyBots[i]}
									<span class="text-xs text-ink-subtle">{t('lobby.bot')}</span>
								{:else if player !== '' && online.mySeat === online.hostSeat && i !== online.mySeat}
									<button
										type="button"
										class="btn-ghost btn-sm"
										data-testid="kick-button"
										onclick={() => online.kick(i)}
									>
										{t('lobby.kick')}
									</button>
								{/if}
							</li>
						{/each}
					</ul>
					{#if online.mySeat === online.hostSeat}
						<button
							type="button"
							data-testid="start-button"
							class="btn-primary"
							onclick={() => online.start()}
						>
							{t('lobby.start')}
						</button>
						<p class="text-xs text-ink-subtle">{t('lobby.botsFillNote')}</p>
					{:else}
						<p class="text-sm text-ink-muted" data-testid="waiting-text">
							{t('lobby.waitingHost')}
						</p>
					{/if}
					{#if online.status === 'connecting' || online.status === 'reconnecting'}
						<p class="text-sm text-gold" data-testid="reconnecting-text">{t('lobby.reconnecting')}</p>
					{/if}
				</section>
			{/if}
		</div>
		<div class="lobby-chat">
			<ChatPanel />
		</div>
	</main>
{/if}

<style>
	.lobby {
		position: relative;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		max-width: 64rem;
		margin-inline: auto;
		padding-inline: 0.75rem;
	}
	.lobby-rail {
		max-width: none;
	}
	.lobby-body {
		flex: 1;
		display: grid;
		place-items: start center;
		padding-block: 2rem;
	}
	.lobby-chat {
		position: absolute;
		right: 0.9rem;
		bottom: 0.9rem;
		z-index: 30;
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

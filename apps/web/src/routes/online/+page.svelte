<script lang="ts">
	import { onMount } from 'svelte';
	import { online } from '$lib/online.svelte';
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
	<title>Online — Thirteen</title>
</svelte:head>

{#if online.status === 'playing'}
	<GameTable store={online}>
		{#snippet nav()}
			<a href="/play" class="nav-link">Vs bots</a>
			<a href="/rules" class="nav-link">Rules</a>
			<ChatPanel />
			{#if online.status !== 'idle'}
				<button type="button" class="btn-ghost btn-sm" onclick={() => online.leave()}>
					Leave room
				</button>
			{/if}
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
				<a href="/play" class="nav-link">Vs bots</a>
				<a href="/rules" class="nav-link">Rules</a>
				{#if online.status !== 'idle'}
					<button type="button" class="btn-ghost btn-sm" onclick={() => online.leave()}>
						Leave room
					</button>
				{/if}
				<ChatPanel />
			</div>
		</header>

		<div class="lobby-body">
			{#if online.status === 'idle'}
				<section class="panel-card" data-testid="connect-panel">
					{#if urlRoom}
						<p class="text-center text-sm text-ink-muted">
							Joining room
							<span class="font-display font-bold tracking-widest text-ink">{urlRoom}</span>
						</p>
					{/if}
					<div class="flex flex-col gap-2">
						<label class="field-label" for="player-name">Your name</label>
						<input
							id="player-name"
							data-testid="name-input"
							class="field-input"
							placeholder="Your name"
							maxlength="16"
							bind:value={name}
						/>
					</div>
					{#if urlRoom}
						{#if online.needsPassword}
							<div class="flex flex-col gap-2">
								<label class="field-label" for="join-password">Room password</label>
								<input
									id="join-password"
									data-testid="join-password-input"
									type="password"
									class="field-input"
									placeholder="Password"
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
							Join game
						</button>
					{:else}
						<div class="flex flex-col gap-2">
							<label class="field-label" for="create-password"
								>Lobby password <span class="font-normal text-ink-subtle">(optional)</span></label
							>
							<input
								id="create-password"
								data-testid="create-password-input"
								type="password"
								class="field-input"
								placeholder="Leave empty for an open room"
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
							Create room
						</button>
						<div class="flex items-end gap-2">
							<div class="flex flex-1 flex-col gap-2">
								<label class="field-label" for="room-code">Room code</label>
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
								Join
							</button>
						</div>
					{/if}
					{#if online.lastError}
						<p class="text-center text-sm text-danger" data-testid="connect-error">
							{online.lastError === 'room_not_found'
								? 'No room with that code.'
								: online.lastError === 'room_full'
									? 'That room is full.'
									: online.lastError === 'bad_password'
										? 'Wrong password — try again.'
										: online.lastError}
						</p>
					{/if}
				</section>
			{:else if online.status === 'lobby' || online.status === 'connecting' || online.status === 'reconnecting'}
				<section class="panel-card items-center" data-testid="room-panel">
					<p class="text-sm text-ink-muted">Room code</p>
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
								{copied ? 'Copied!' : 'Copy link'}
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
									{player === '' ? 'Empty seat' : player}
									{#if player === ''}<span class="text-xs text-ink-subtle">bot will fill</span>{/if}
									{i === online.mySeat ? ' (you)' : ''}
								</span>
								{#if online.lobbyBots[i]}
									<span class="text-xs text-ink-subtle">bot</span>
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
							Start game
						</button>
						<p class="text-xs text-ink-subtle">Empty seats are filled with bots.</p>
					{:else}
						<p class="text-sm text-ink-muted" data-testid="waiting-text">
							Waiting for the host to start…
						</p>
					{/if}
					{#if online.status === 'reconnecting'}
						<p class="text-sm text-gold">Reconnecting…</p>
					{/if}
				</section>
			{/if}
		</div>
	</main>
{/if}

<style>
	.lobby {
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

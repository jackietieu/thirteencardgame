<script lang="ts">
	import { onMount } from 'svelte';
	import { online } from '$lib/online.svelte';
	import { getName, setName } from '$lib/name';
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
</script>

<svelte:head>
	<title>Online — Thirteen</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-5xl flex-col gap-3 p-2 sm:p-4">
	<header class="flex items-center justify-between gap-3">
		<h1 class="text-lg font-bold tracking-tight">Thirteen — Online</h1>
		<div class="flex items-center gap-2 text-sm">
			<a href="/play" class="text-emerald-300 underline-offset-2 hover:underline">Vs bots</a>
			<a href="/rules" class="text-emerald-300 underline-offset-2 hover:underline">Rules</a>
			{#if online.status !== 'idle'}
				<button
					type="button"
					class="rounded-lg border border-emerald-700/60 px-3 py-1 font-semibold text-emerald-100 transition hover:bg-emerald-900/50"
					onclick={() => online.leave()}
				>
					Leave room
				</button>
			{/if}
		</div>
	</header>

	{#if online.status === 'idle'}
		<section class="mx-auto flex w-full max-w-md flex-col gap-6 rounded-2xl border border-emerald-800/60 bg-emerald-900/40 p-6" data-testid="connect-panel">
			{#if urlRoom}
				<p class="text-center text-sm text-emerald-300">
					Joining room <span class="font-bold tracking-widest text-emerald-100">{urlRoom}</span>
				</p>
			{/if}
			<div class="flex flex-col gap-2">
				<label class="text-sm font-semibold text-emerald-200" for="player-name">Your name</label>
				<input
					id="player-name"
					data-testid="name-input"
					class="rounded-lg border border-emerald-700/60 bg-emerald-950/60 px-3 py-2 text-emerald-100 outline-none focus:border-emerald-400"
					placeholder="Your name"
					maxlength="16"
					bind:value={name}
				/>
			</div>
			{#if urlRoom}
				{#if online.needsPassword}
					<div class="flex flex-col gap-2">
						<label class="text-sm font-semibold text-emerald-200" for="join-password">Room password</label>
						<input
							id="join-password"
							data-testid="join-password-input"
							type="password"
							class="rounded-lg border border-emerald-700/60 bg-emerald-950/60 px-3 py-2 text-emerald-100 outline-none focus:border-emerald-400"
							placeholder="Password"
							maxlength="24"
							bind:value={joinPassword}
						/>
					</div>
				{/if}
				<button
					type="button"
					data-testid="join-button"
					class="rounded-xl bg-emerald-500 px-6 py-3 text-lg font-semibold text-emerald-950 shadow transition hover:bg-emerald-400"
					onclick={() => join(urlRoom)}
				>
					Join game
				</button>
			{:else}
				<div class="flex flex-col gap-2">
					<label class="text-sm font-semibold text-emerald-200" for="create-password">Lobby password <span class="font-normal text-emerald-400/70">(optional)</span></label>
					<input
						id="create-password"
						data-testid="create-password-input"
						type="password"
						class="rounded-lg border border-emerald-700/60 bg-emerald-950/60 px-3 py-2 text-emerald-100 outline-none focus:border-emerald-400"
						placeholder="Leave empty for an open room"
						maxlength="24"
						bind:value={createPassword}
					/>
				</div>
				<button
					type="button"
					data-testid="create-room"
					class="rounded-xl bg-emerald-500 px-6 py-3 text-lg font-semibold text-emerald-950 shadow transition hover:bg-emerald-400"
					onclick={create}
				>
					Create room
				</button>
				<div class="flex items-end gap-2">
					<div class="flex flex-1 flex-col gap-2">
						<label class="text-sm font-semibold text-emerald-200" for="room-code">Room code</label>
						<input
							id="room-code"
							data-testid="room-code-input"
							class="rounded-lg border border-emerald-700/60 bg-emerald-950/60 px-3 py-2 uppercase tracking-widest text-emerald-100 outline-none focus:border-emerald-400"
							placeholder="ABCD"
							maxlength="4"
							bind:value={joinCode}
						/>
					</div>
					<button
						type="button"
						data-testid="join-button"
						class="rounded-xl border border-emerald-500 px-5 py-3 font-semibold text-emerald-100 transition hover:bg-emerald-900/60"
						onclick={() => join()}
					>
						Join
					</button>
				</div>
			{/if}
			{#if online.lastError}
				<p class="text-center text-sm text-red-300" data-testid="connect-error">
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
		<section class="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-emerald-800/60 bg-emerald-900/40 p-6" data-testid="room-panel">
			<p class="text-sm text-emerald-300">Room code</p>
			<p class="text-4xl font-bold tracking-[0.3em] text-emerald-100" data-testid="room-code">{online.room}</p>
			{#if online.status === 'lobby'}
				<div class="flex w-full items-center gap-2">
					<input
						readonly
						data-testid="share-link"
						class="min-w-0 flex-1 rounded-lg border border-emerald-700/60 bg-emerald-950/60 px-3 py-2 text-xs text-emerald-300 outline-none"
						value={shareUrl()}
						onfocus={(e) => e.currentTarget.select()}
					/>
					<button
						type="button"
						data-testid="share-copy"
						class="shrink-0 rounded-lg border border-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-900/60"
						onclick={copyLink}
					>
						{copied ? 'Copied!' : 'Copy link'}
					</button>
				</div>
			{/if}
			<ul class="w-full text-sm text-emerald-200">
				{#each online.lobbyPlayers as player, i}
					<li class="flex items-center justify-between rounded-lg px-2 py-1 {i === online.mySeat ? 'bg-emerald-800/40' : ''}">
						<span>{player === '' ? 'Empty seat' : player}{i === online.mySeat ? ' (you)' : ''}</span>
						{#if online.lobbyBots[i]}
							<span class="text-xs text-emerald-400/70">bot</span>
						{/if}
					</li>
				{/each}
			</ul>
			{#if online.mySeat === online.hostSeat}
				<button
					type="button"
					data-testid="start-button"
					class="rounded-xl bg-emerald-500 px-8 py-3 text-lg font-semibold text-emerald-950 shadow transition hover:bg-emerald-400"
					onclick={() => online.start()}
				>
					Start game
				</button>
				<p class="text-xs text-emerald-400/70">Empty seats are filled with bots.</p>
			{:else}
				<p class="text-sm text-emerald-300" data-testid="waiting-text">Waiting for the host to start…</p>
			{/if}
			{#if online.status === 'reconnecting'}
				<p class="text-sm text-amber-300">Reconnecting…</p>
			{/if}
		</section>
	{:else}
		<GameTable store={online} />
	{/if}
</main>

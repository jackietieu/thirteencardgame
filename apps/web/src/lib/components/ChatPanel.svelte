<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import { online } from '$lib/online.svelte';

	let open = $state(false);
	let draft = $state('');
	let listEl: HTMLOListElement | undefined = $state();

	// Opening the panel clears the unread badge.
	$effect(() => {
		if (open) online.markChatRead();
	});

	// Keep the newest message in view.
	$effect(() => {
		void online.chat.length;
		if (listEl) listEl.scrollTop = listEl.scrollHeight;
	});

	// Moderation notices fade after a few seconds.
	$effect(() => {
		if (!online.chatNotice) return;
		const t = setTimeout(() => (online.chatNotice = ''), 4000);
		return () => clearTimeout(t);
	});

	function send() {
		const text = draft;
		draft = '';
		online.sendChat(text);
	}
</script>

<details data-testid="chat-drawer" bind:open class="chat-drawer">
	<summary class="icon-btn" aria-label={t('chat.aria')} title={t('chat.aria')}>
		<svg viewBox="0 0 24 24" class="size-5" aria-hidden="true"
			><path
				d="M21 11.5a8.4 8.4 0 0 1-8.4 8.3 8.8 8.8 0 0 1-3.3-.6L4 20.3l1.1-4.1a8 8 0 0 1-1.2-4.7A8.4 8.4 0 0 1 12.6 3.2a8.4 8.4 0 0 1 8.4 8.3z"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				fill="none"
			/></svg
		>
		{#if online.chatUnread > 0 && !open}
			<span class="chat-unread">{online.chatUnread}</span>
		{/if}
	</summary>
	<div class="chat-panel">
		<div class="chat-head">{t('chat.title')}</div>
		<ol bind:this={listEl}>
			{#each online.chat as m, i (i)}
				<li class:mine={m.seat === 0}>
					<span class="chat-name">{m.name}</span>
					<span class="chat-text">{m.text}</span>
				</li>
			{:else}
				<li class="chat-empty">{t('chat.empty')}</li>
			{/each}
		</ol>
			{#if online.chatNotice}
				<p class="chat-notice" role="alert">{online.chatNotice === 'chat_blocked' ? t('chat.blocked') : online.chatNotice}</p>
		{/if}
		<form
			class="chat-form"
			onsubmit={(e) => {
				e.preventDefault();
				send();
			}}
		>
			<input
				data-testid="chat-input"
				bind:value={draft}
				maxlength="280"
				placeholder={t('chat.placeholder')}
				aria-label={t('chat.message.aria')}
			/>
			<button type="submit" class="btn-ghost btn-sm" disabled={draft.trim().length === 0}>
				{t('chat.send')}
			</button>
		</form>
	</div>
</details>

<style>
	.chat-drawer {
		position: relative;
	}
	summary.icon-btn {
		list-style: none;
		position: relative;
	}
	summary.icon-btn::-webkit-details-marker {
		display: none;
	}
	.chat-unread {
		position: absolute;
		top: 0.25rem;
		right: 0.25rem;
		min-width: 0.9rem;
		padding: 0 0.2rem;
		border-radius: 999px;
		background: var(--color-gold);
		color: var(--color-accent-ink);
		font-size: 0.5625rem;
		font-weight: 700;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.chat-drawer:not([open]) .chat-panel {
		display: none;
	}
	.chat-panel {
		position: fixed;
		top: 3.4rem;
		right: 0.75rem;
		z-index: 60;
		width: min(21rem, calc(100vw - 1.5rem));
		max-height: min(34rem, 70dvh);
		display: flex;
		flex-direction: column;
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-panel);
		box-shadow: var(--shadow-card-lift);
		padding: 0.75rem;
	}
	.chat-head {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--color-ink);
		padding: 0 0.25rem 0.5rem;
		border-bottom: 1px solid var(--color-hairline);
		margin-bottom: 0.5rem;
	}
	ol {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.75rem;
		color: var(--color-ink-muted);
		padding: 0 0.25rem;
		min-height: 3rem;
	}
	li {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	li.mine .chat-name {
		color: var(--color-accent);
	}
	.chat-name {
		font-weight: 600;
		color: var(--color-ink);
		white-space: nowrap;
	}
	.chat-text {
		color: var(--color-ink-muted);
		overflow-wrap: anywhere;
	}
	.chat-empty {
		font-style: italic;
		color: var(--color-ink-subtle);
	}
	.chat-notice {
		margin: 0.25rem 0 0;
		font-size: 0.6875rem;
		color: var(--color-gold);
		padding: 0 0.25rem;
	}
	.chat-form {
		display: flex;
		gap: 0.4rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--color-hairline);
		margin-top: 0.5rem;
	}
	.chat-form input {
		flex: 1;
		min-width: 0;
		background: var(--color-bg);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-pod);
		color: var(--color-ink);
		font-size: 0.8125rem;
		padding: 0.4rem 0.6rem;
	}
	.chat-form input:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 1px;
	}
</style>

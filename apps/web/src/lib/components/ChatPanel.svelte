<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import { online } from '$lib/online.svelte';

	let draft = $state('');
	let listEl: HTMLOListElement | undefined = $state();

	// Keep the newest message in view.
	$effect(() => {
		void online.chat.length;
		if (listEl) listEl.scrollTop = listEl.scrollHeight;
	});

	// Moderation notices fade after a few seconds.
	$effect(() => {
		if (!online.chatNotice) return;
		const timer = setTimeout(() => (online.chatNotice = ''), 4000);
		return () => clearTimeout(timer);
	});

	function send() {
		const text = draft;
		draft = '';
		online.sendChat(text);
	}
</script>

<aside class="chat-dock" data-testid="chat-dock" aria-label={t('chat.aria')}>
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
</aside>

<style>
	.chat-dock {
		display: flex;
		flex-direction: column;
		width: 14rem;
		height: 12rem;
		border: 1px solid var(--color-hairline);
		border-radius: 0.9rem;
		box-shadow: var(--shadow-pod);
		overflow: hidden;
	}
	.chat-head {
		flex-shrink: 0;
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-ink-muted);
		padding: 0.4rem 0.7rem;
		border-bottom: 1px solid var(--color-hairline);
	}
	ol {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		list-style: none;
		margin: 0;
		padding: 0.5rem 0.7rem;
	}
	li {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		font-size: 0.75rem;
		line-height: 1.35;
	}
	li.mine {
		align-items: flex-end;
		text-align: right;
	}
	.chat-name {
		font-size: 0.625rem;
		font-weight: 700;
		color: var(--color-ink-subtle);
	}
	li.mine .chat-name {
		color: var(--color-gold);
	}
	.chat-text {
		color: var(--color-ink);
		overflow-wrap: anywhere;
	}
	.chat-empty {
		color: var(--color-ink-subtle);
		font-style: italic;
	}
	.chat-notice {
		flex-shrink: 0;
		font-size: 0.6875rem;
		color: var(--color-danger, #e5484d);
		padding: 0 0.7rem 0.3rem;
	}
	.chat-form {
		flex-shrink: 0;
		display: flex;
		gap: 0.35rem;
		padding: 0.45rem 0.5rem;
		border-top: 1px solid var(--color-hairline);
	}
	.chat-form input {
		flex: 1;
		min-width: 0;
		font-size: 0.75rem;
		color: var(--color-ink);
		background: var(--color-surface-raised);
		border: 1px solid var(--color-hairline);
		border-radius: 0.5rem;
		padding: 0.3rem 0.5rem;
	}
	.chat-form input:focus {
		outline: none;
		border-color: var(--color-gold);
	}
</style>

<script lang="ts">
	import { currentRequirement, describeMove, type RulesState } from '@thirteen/engine';

	interface Props {
		state: RulesState;
		names: string[];
	}

	let { state, names }: Props = $props();

	const requirement = $derived(state.phase === 'playing' ? currentRequirement(state) : null);
	const yourTurn = $derived(state.phase === 'playing' && state.turn === 0);
	const opening = $derived(state.opening && state.handNumber === 0);
</script>

{#if state.phase === 'playing'}
	<div
		data-testid="turn-banner"
		class="prompt {yourTurn ? 'prompt-you' : ''}"
		role="status"
	>
		{#if yourTurn}
			<span class="prompt-bullet pulse-dot" aria-hidden="true"></span>
			{#if requirement}
				<span>Your turn — beat {describeMove(requirement)} or pass</span>
			{:else if opening}
				<span>Your turn — first play must include the 3♠</span>
			{:else}
				<span>Your turn — lead any combination</span>
			{/if}
		{:else if state.turn >= 0}
			<span class="prompt-wait">Waiting for {names[state.turn]}…</span>
		{/if}
	</div>
{/if}

<style>
	.prompt {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-ink-muted);
		padding: 0.25rem 0.75rem;
		border-radius: 999px;
	}
	.prompt-you {
		color: var(--color-gold);
		background: color-mix(in oklab, var(--color-gold) 10%, transparent);
	}
	.prompt-bullet {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--color-gold);
		flex-shrink: 0;
	}
	.prompt-wait {
		color: var(--color-ink-muted);
	}
</style>

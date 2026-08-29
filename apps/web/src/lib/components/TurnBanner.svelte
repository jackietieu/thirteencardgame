<script lang="ts">
	import { currentRequirement, describeMove, type GameState } from '@thirteen/engine';

	interface Props {
		state: GameState;
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
		class="rounded-xl px-4 py-2 text-center text-sm font-semibold
			{yourTurn ? 'bg-amber-400/15 text-amber-200' : 'bg-emerald-900/60 text-emerald-200'}"
		role="status"
	>
		{#if yourTurn}
			{#if requirement}
				Your turn — beat {describeMove(requirement)} or pass
			{:else if opening}
				Your turn — first play must include the 3♠
			{:else}
				Your turn — lead any combination
			{/if}
		{:else if state.turn >= 0}
			Waiting for {names[state.turn]}…
		{/if}
	</div>
{/if}

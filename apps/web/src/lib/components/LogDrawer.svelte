<script lang="ts">
	import { describeMove } from '@thirteen/engine';
	import { game, type LogEntry } from '$lib/game.svelte';

	interface Props {
		log: LogEntry[];
	}

	let { log }: Props = $props();

	let open = $state(false);

	// Newest first for display.
	const entries = $derived([...log].reverse());
</script>

<details
	data-testid="log-drawer"
	bind:open
	class="rounded-xl border border-emerald-800/60 bg-emerald-900/40 px-3 py-2 text-sm"
>
	<summary class="cursor-pointer select-none font-semibold text-emerald-200">
		Move log ({log.length})
	</summary>
	<ol class="mt-2 max-h-56 space-y-0.5 overflow-y-auto text-xs text-emerald-100/90">
		{#each entries as entry, i (log.length - i)}
			<li>
				<span class="text-emerald-400/80">H{entry.handNumber + 1}</span>
				<span class="font-semibold">{game.seatNames[entry.seat]}</span>
				— {describeMove(entry.action)}
			</li>
		{/each}
		{#if log.length === 0}
			<li class="text-emerald-400/70 italic">No moves yet.</li>
		{/if}
	</ol>
</details>

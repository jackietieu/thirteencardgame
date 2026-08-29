<script lang="ts">
	interface Props {
		name: string;
		position: 'left' | 'top' | 'right';
		cardCount: number;
		isTurn: boolean;
		passed: boolean;
		out: boolean;
	}

	let { name, position = 'left', cardCount, isTurn, passed, out }: Props = $props();

	const shownBacks = $derived(Math.min(cardCount, 5));
</script>

<div
	data-seat={name}
	class="flex items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-colors
		{position === 'top' ? 'flex-row' : ''}
		{isTurn ? 'border-amber-400/90 bg-emerald-800/70 shadow-[0_0_12px_rgb(251_191_36/0.25)]' : 'border-emerald-800/60 bg-emerald-900/50'}
		{out ? 'opacity-50' : ''}"
>
	<div class="flex" aria-hidden="true">
		{#each Array(shownBacks) as _, i (i)}
			<span class="card-back {i > 0 ? '-ml-4' : ''}"></span>
		{/each}
	</div>
	<div class="min-w-20">
		<div class="flex items-center gap-1.5 text-sm font-semibold">
			<span>{name}</span>
			<span class="rounded-full bg-emerald-950/70 px-1.5 py-0.5 text-xs font-normal text-emerald-200">
				{cardCount} card{cardCount === 1 ? '' : 's'}
			</span>
		</div>
		<div class="text-xs text-emerald-300/90">
			{#if out}
				Out
			{:else if passed}
				Passed
			{:else if isTurn}
				Thinking…
			{/if}
		</div>
	</div>
</div>

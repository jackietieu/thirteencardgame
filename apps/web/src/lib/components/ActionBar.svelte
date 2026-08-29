<script lang="ts">
	interface Props {
		canPlay: boolean;
		canPass: boolean;
		reason: string | null;
		autoPass: boolean;
		onPlay: () => void;
		onPass: () => void;
		onToggleAutoPass: (value: boolean) => void;
		shakeKey: number;
	}

	let { canPlay, canPass, reason, autoPass, onPlay, onPass, onToggleAutoPass, shakeKey }: Props =
		$props();
</script>

<div class="flex flex-col items-center gap-2">
	<div class="flex items-center gap-3">
		<button
			type="button"
			data-testid="play-button"
			disabled={!canPlay}
			onclick={onPlay}
			class="rounded-xl bg-emerald-500 px-6 py-2.5 font-semibold text-emerald-950 shadow transition
				hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-500"
		>
			Play
		</button>
		<button
			type="button"
			data-testid="pass-button"
			disabled={!canPass}
			onclick={onPass}
			class="rounded-xl border border-emerald-600/70 px-6 py-2.5 font-semibold text-emerald-100 shadow transition
				hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-40"
		>
			Pass
		</button>
	</div>

	{#if reason}
		{#key shakeKey}
			<p data-testid="play-reason" class="shake text-sm text-red-300">{reason}</p>
		{/key}
	{/if}

	<label class="flex items-center gap-2 text-xs text-emerald-300">
		<input
			type="checkbox"
			checked={autoPass}
			onchange={(e) => onToggleAutoPass(e.currentTarget.checked)}
			class="accent-emerald-500"
		/>
		Auto-pass when stuck
	</label>
</div>

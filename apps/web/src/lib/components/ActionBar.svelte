<script lang="ts">
	interface Props {
		canPlay: boolean;
		canPass: boolean;
		reason: string | null;
		/** Classified name of the current selection, or why it is not a combo. */
		summary: string | null;
		autoPass: boolean;
		onPlay: () => void;
		onPass: () => void;
		onToggleAutoPass: (value: boolean) => void;
		shakeKey: number;
	}

	let { canPlay, canPass, reason, summary, autoPass, onPlay, onPass, onToggleAutoPass, shakeKey }: Props =
		$props();
</script>

<div class="flex flex-col items-center gap-1.5">
	{#if summary}
		<span class="combo-chip">{summary}</span>
	{/if}
	<div class="flex items-center gap-2">
		<button
			type="button"
			data-testid="play-button"
			disabled={!canPlay}
			onclick={onPlay}
			class="btn-primary"
		>
			Play <kbd>↵</kbd>
		</button>
		<button
			type="button"
			data-testid="pass-button"
			disabled={!canPass}
			onclick={onPass}
			class="btn-ghost"
		>
			Pass <kbd>P</kbd>
		</button>
	</div>

	{#if reason}
		{#key shakeKey}
			<p data-testid="play-reason" class="reason-pill shake">{reason}</p>
		{/key}
	{/if}

	<button
		type="button"
		role="switch"
		aria-checked={autoPass}
		class="auto-row"
		onclick={() => onToggleAutoPass(!autoPass)}
	>
		<span class="switch" aria-checked={autoPass} aria-hidden="true"></span>
		<span>Auto-pass when stuck</span>
	</button>
</div>

<style>
	.combo-chip {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-ink-muted);
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: 999px;
		padding: 0.15rem 0.7rem;
	}
	.auto-row {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2rem;
		font-size: 0.75rem;
		color: var(--color-ink-muted);
		transition: color var(--dur-fast);
	}
	.auto-row:hover {
		color: var(--color-ink);
	}
</style>

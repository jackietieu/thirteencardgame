<script lang="ts">
	interface Props {
		class?: string;
		style?: string;
	}
	let { class: cls = '', style = '' }: Props = $props();

	const SPADE =
		'M12 2C8.4 6.9 4 9.2 4 13.1a4.1 4.1 0 0 0 7.2 2.7c-.3 2.5-1.4 4-3.2 5.2h8c-1.8-1.2-2.9-2.7-3.2-5.2a4.1 4.1 0 0 0 7.2-2.7C20 9.2 15.6 6.9 12 2z';
</script>

<span class="cback {cls}" {style} aria-hidden="true">
	<svg viewBox="0 0 24 24" class="cback-suit"><path d={SPADE} fill="currentColor" /></svg>
</span>

<style>
	.cback {
		--back-w: 1.9rem;
		display: inline-block;
		position: relative;
		width: var(--back-w);
		aspect-ratio: 2.5 / 3.5;
		border-radius: calc(var(--back-w) * 0.09);
		background:
			repeating-linear-gradient(45deg, var(--color-card-back-ink) 0 1.5px, transparent 1.5px 5px),
			repeating-linear-gradient(-45deg, var(--color-card-back-ink) 0 1.5px, transparent 1.5px 5px),
			var(--color-card-back);
		box-shadow:
			var(--shadow-card),
			inset 0 0 0 1.5px rgb(251 250 246 / 0.7);
		color: var(--color-card-face);
		container-type: inline-size;
		flex-shrink: 0;
	}
	.cback-suit {
		position: absolute;
		inset: 0;
		margin: auto;
		width: 52%;
		height: 52%;
		opacity: 0.25;
	}
	@container (max-width: 30px) {
		.cback-suit {
			display: none;
		}
	}
</style>

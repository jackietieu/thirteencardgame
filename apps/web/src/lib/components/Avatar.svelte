<script lang="ts">
	import { nameHue } from '$lib/ui';

	interface Props {
		name: string;
		dim?: boolean;
	}
	let { name, dim = false }: Props = $props();

	const hue = $derived(nameHue(name));
	const initial = $derived((name.trim().charAt(0) || '?').toUpperCase());
</script>

<span
	class="avatar {dim ? 'avatar-dim' : ''}"
	style="background: oklch(0.45 0.08 {hue}); color: oklch(0.94 0.02 {hue})"
	aria-hidden="true"
>{initial}</span>

<style>
	.avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		font-family: var(--font-display);
		font-size: 0.875rem;
		font-weight: 700;
		flex-shrink: 0;
		box-shadow: inset 0 -2px 4px rgb(0 0 0 / 0.25);
	}
	.avatar-dim {
		filter: saturate(0.4) brightness(0.8);
	}
</style>

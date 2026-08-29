<script lang="ts">
	import { marked } from 'marked';
	import rules from '../../../../../RULES.md?raw';

	const html = $derived(marked.parse(rules, { async: false }));
</script>

<svelte:head>
	<title>Rules — Thirteen</title>
</svelte:head>

<main class="mx-auto min-h-dvh max-w-3xl px-4 py-8">
	<header class="mb-6 flex justify-end">
		<a href="/play" class="text-sm text-emerald-300 underline-offset-2 hover:underline">Play →</a>
	</header>
	<!-- eslint-disable-next-line svelte/no-at-html-tags — static project doc, no user input -->
	<article class="rules">
		{@html html}
	</article>
</main>

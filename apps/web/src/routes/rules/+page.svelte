<script lang="ts">
	import { marked } from 'marked';
	import rules from '../../../../../RULES.md?raw';

	const rendered = $derived.by(() => {
		const headings = [...rules.matchAll(/^## (.+)$/gm)].map((m) => m[1]!.trim());
		let i = 0;
		const html = String(marked.parse(rules, { async: false })).replace(
			/<h2>/g,
			() => `<h2 id="sec-${i++}">`
		);
		return { headings, html };
	});
</script>

<svelte:head>
	<title>Rules — Thirteen</title>
</svelte:head>

<main class="mx-auto min-h-dvh max-w-6xl px-4 py-6 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
	<nav class="rules-nav" aria-label="Sections">
		{#each rendered.headings as heading, i (heading)}
			<a href="#sec-{i}">{heading}</a>
		{/each}
	</nav>
	<div>
		<header class="mb-4 flex justify-end">
			<a href="/play" class="nav-link">Play →</a>
		</header>
		<!-- eslint-disable-next-line svelte/no-at-html-tags — static project doc, no user input -->
		<article class="rules">
			{@html rendered.html}
		</article>
	</div>
</main>

<script lang="ts">
	import { marked } from 'marked';
	import rulesEn from '../../../../../RULES.md?raw';
	import rulesVi from '$lib/rules/vi.md?raw';
	import rulesHans from '$lib/rules/zh-Hans.md?raw';
	import rulesHant from '$lib/rules/zh-Hant.md?raw';
	import { i18n, t } from '$lib/i18n.svelte';
	import LanguagePicker from '$lib/components/LanguagePicker.svelte';

	const DOCS: Record<string, string> = {
		en: rulesEn,
		vi: rulesVi,
		'zh-Hans': rulesHans,
		'zh-Hant': rulesHant
	};

	const rendered = $derived.by(() => {
		const rules = DOCS[i18n.locale] ?? rulesEn;
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
	<title>{t('title.rules')}</title>
</svelte:head>
<main class="mx-auto min-h-dvh max-w-6xl px-4 py-6 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
	<nav class="rules-nav" aria-label={t('rules.sections')}>
		{#each rendered.headings as heading, i (heading)}
			<a href="#sec-{i}">{heading}</a>
		{/each}
	</nav>
	<div>
		<header class="mb-4 flex justify-end items-center gap-2">
			<LanguagePicker />
			<a href="/play" class="nav-link">{t('rules.play')}</a>
		</header>
		<!-- eslint-disable-next-line svelte/no-at-html-tags — static project doc, no user input -->
		<article class="rules">
			{@html rendered.html}
		</article>
	</div>
</main>

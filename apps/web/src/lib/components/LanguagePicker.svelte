<script lang="ts">
	import { LOCALES, i18n, setLocale, t, type Locale } from '$lib/i18n.svelte';
</script>

<label class="lang-picker" data-testid="lang-picker">
	<span class="sr-only">{t('lang.aria')}</span>
	<select
		aria-label={t('lang.aria')}
		value={i18n.locale}
		onchange={(e) => setLocale(e.currentTarget.value as Locale)}
	>
		{#each LOCALES as l (l.code)}
			<option value={l.code}>{l.label}</option>
		{/each}
	</select>
</label>

<style>
	.lang-picker select {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-ink-muted);
		background: transparent;
		border: 1px solid var(--color-hairline);
		border-radius: 999px;
		padding: 0.2rem 0.5rem;
		cursor: pointer;
		transition: color var(--dur-fast), border-color var(--dur-fast);
	}
	.lang-picker select:hover {
		color: var(--color-ink);
		border-color: var(--color-ink-muted);
	}
	.lang-picker select option {
		color: initial;
		background: var(--color-surface);
	}
</style>

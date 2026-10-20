<script lang="ts">
	import '@menzies-mariesta-com/menzies-design-wash-ui/styles.css';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	onMount(async () => {
		const { initWash } = await import('@menzies-mariesta-com/menzies-design-wash-ui/core');
		initWash({ defaultPigment: 'mineral', defaultMode: 'light' });
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Tok4K · Menzies</title>
	<meta
		name="description"
		content="Tok4K by Menzies Organization — near-original TikTok quality via on-device MP4 optimize and TikTok web Upload HD."
	/>
</svelte:head>

<div class="page-wash paper-grain wash-shell min-h-dvh">
	<header class="border-b border-ink-border/15 px-4 py-3 sm:px-6">
		<div class="mx-auto flex max-w-3xl items-center justify-between gap-3">
			<a href="/" class="min-w-0">
				<span class="block font-semibold tracking-tight text-base sm:text-lg">Tok4K</span>
				<span class="block text-xs opacity-60">Menzies Organization</span>
			</a>
			<nav class="flex items-center gap-2">
				<a href="/optimize" class="btn btn-ghost btn-sm app-touch">Optimize</a>
				{#if data.signedIn}
					<a href="/studio" class="btn btn-ghost btn-sm app-touch">Studio</a>
					<a href="/auth/logout" class="btn btn-outline btn-sm app-touch">Disconnect</a>
				{/if}
			</nav>
		</div>
	</header>

	<main class="wash-shell-main px-4 py-6 sm:px-6 sm:py-10">
		<div class="mx-auto w-full max-w-3xl">
			{@render children()}
		</div>
	</main>

	<footer class="border-t border-ink-border/10 px-4 py-4 text-center text-xs opacity-60 sm:px-6">
		<a href="/terms" class="link link-hover">Terms</a>
		<span class="mx-2">·</span>
		<a href="/privacy" class="link link-hover">Privacy</a>
		<span class="mx-2">·</span>
		<span>Tok4K · Menzies Organization</span>
	</footer>
</div>

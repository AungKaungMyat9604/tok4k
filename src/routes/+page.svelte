<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<article class="wash-panel paper-grain space-y-6">
	<div class="space-y-3">
		<p class="text-sm uppercase tracking-wide opacity-70">Menzies Organization</p>
		<h1 class="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Tok4K</h1>
		<p class="text-base leading-relaxed opacity-80 sm:text-lg">
			Near-original TikTok quality — optimize your MP4/MOV on-device (no re-encode), then upload
			via TikTok web with Upload HD.
		</p>
	</div>

	{#if data.errorMessage}
		<div role="alert" class="alert alert-warning">
			<span>
				{data.errorMessage}
				{#if data.errorDetail}
					<span class="opacity-70"> ({data.errorDetail})</span>
				{/if}
			</span>
		</div>
	{/if}

	<div class="space-y-3 rounded-lg border border-ink-border/15 p-4 text-sm leading-relaxed opacity-90">
		<p>
			<strong>Best quality path:</strong> Optimize → download → post on
			<a class="link" href="https://www.tiktok.com/tiktokstudio/upload" target="_blank" rel="noopener noreferrer"
				>TikTok Studio / web</a
			>
			with <strong>Upload HD</strong> and visibility <strong>Everyone</strong>. Don’t edit after
			upload.
		</p>
		<p>
			<strong>Why not Direct Post?</strong> The official API still re-encodes for delivery and
			sandbox forces Only me — usually worse delivered quality. Direct Post remains available in
			Studio if you need it.
		</p>
	</div>

	<div class="flex flex-col gap-3 sm:flex-row">
		<a href="/optimize" class="btn btn-primary btn-lg app-touch ripple w-full sm:w-auto">
			Optimize video
		</a>
		{#if data.signedIn}
			<a href="/studio" class="btn btn-outline btn-lg app-touch w-full sm:w-auto">
				Direct Post studio
			</a>
		{:else if data.tiktokConfigured}
			<a href="/auth/tiktok" class="btn btn-ghost btn-lg app-touch w-full sm:w-auto">
				Connect for Direct Post
			</a>
		{/if}
	</div>
</article>

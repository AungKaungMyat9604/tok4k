<script lang="ts">
	import { formatBytes } from '#lib/format';
	import { probeVideo, type VideoProbe } from '#lib/upload/probe';
	import {
		downloadBlob,
		optimizeForTikTok,
		TIKTOK_WEB_UPLOAD_URL,
		type OptimizeStats
	} from '#lib/optimize/pipeline';

	let file = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let probe = $state<VideoProbe | null>(null);
	let phase = $state<'idle' | 'probing' | 'optimizing' | 'ready' | 'error'>('idle');
	let errorMessage = $state('');
	let progressLabel = $state('');
	let optimizedBlob = $state<Blob | null>(null);
	let stats = $state<OptimizeStats | null>(null);

	function revokePreview() {
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
			previewUrl = null;
		}
	}

	async function onFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const next = input.files?.[0] ?? null;
		revokePreview();
		file = next;
		probe = null;
		optimizedBlob = null;
		stats = null;
		errorMessage = '';
		progressLabel = '';
		phase = 'idle';

		if (!next) return;

		previewUrl = URL.createObjectURL(next);
		phase = 'probing';
		try {
			probe = await probeVideo(next);
			phase = 'idle';
		} catch {
			probe = {
				name: next.name,
				size: next.size,
				mimeType: next.type || 'application/octet-stream',
				width: null,
				height: null,
				durationSec: null,
				fps: null
			};
			phase = 'idle';
		}
	}

	async function runOptimize() {
		if (!file) return;
		errorMessage = '';
		optimizedBlob = null;
		stats = null;
		phase = 'optimizing';
		progressLabel = 'Normalizing container…';

		try {
			await new Promise((r) => setTimeout(r, 30));
			progressLabel = 'Inflating frame density (no re-encode)…';
			const result = await optimizeForTikTok(file);
			optimizedBlob = result.blob;
			stats = result.stats;
			phase = 'ready';
			progressLabel = 'Ready — download, then upload on TikTok web';
		} catch (err) {
			phase = 'error';
			errorMessage = err instanceof Error ? err.message : 'Optimize failed';
			progressLabel = '';
		}
	}

	function downloadOptimized() {
		if (!optimizedBlob || !stats) return;
		downloadBlob(optimizedBlob, stats.outputName);
	}

	function openTikTokUpload() {
		window.open(TIKTOK_WEB_UPLOAD_URL, '_blank', 'noopener,noreferrer');
	}
</script>

<article class="wash-panel paper-grain space-y-6 pb-28 sm:pb-8">
	<div class="space-y-2">
		<p class="text-sm uppercase tracking-wide opacity-70">Near-original quality</p>
		<h1 class="text-2xl font-semibold sm:text-3xl">Optimize for TikTok</h1>
		<p class="text-sm leading-relaxed opacity-80 sm:text-base">
			Prep your MP4/MOV in the browser (no re-encode), download it, then post via
			<strong>TikTok web / Studio</strong> with Upload HD. This path beats Direct Post for
			delivered quality.
		</p>
	</div>

	<label class="app-file-hit w-full">
		<input
			type="file"
			accept="video/mp4,video/quicktime,.mp4,.mov"
			class="sr-only"
			onchange={onFileChange}
		/>
		<span class="font-medium">Drop MP4 / MOV here</span>
		<span class="text-sm opacity-70">H.264 or H.265 · processed on-device only</span>
		{#if file}
			<span class="text-sm font-medium">{file.name}</span>
		{/if}
	</label>

	{#if previewUrl}
		<!-- svelte-ignore a11y_media_has_caption -->
		<video
			class="max-h-72 w-full rounded-lg bg-black object-contain"
			src={previewUrl}
			controls
			playsinline
			preload="metadata"
		></video>
	{/if}

	{#if probe}
		<div class="app-meta-grid">
			<div class="app-meta-item">
				<span>Size</span>
				<strong>{formatBytes(probe.size)}</strong>
			</div>
			<div class="app-meta-item">
				<span>Type</span>
				<strong>{probe.mimeType || '—'}</strong>
			</div>
			<div class="app-meta-item">
				<span>Resolution</span>
				<strong
					>{probe.width && probe.height ? `${probe.width}×${probe.height}` : '—'}</strong
				>
			</div>
			<div class="app-meta-item">
				<span>FPS</span>
				<strong>{probe.fps ?? '—'}</strong>
			</div>
		</div>
	{/if}

	{#if phase === 'optimizing'}
		<div class="space-y-2">
			<progress class="progress progress-primary w-full"></progress>
			<p class="text-sm opacity-80">{progressLabel}</p>
		</div>
	{/if}

	{#if stats && phase === 'ready'}
		<div role="status" class="alert alert-success space-y-2 text-sm">
			<p>
				Optimized <code>{stats.outputName}</code> · {formatBytes(stats.inputBytes)} →
				{formatBytes(stats.outputBytes)} · frames {stats.originalFrames} →
				{stats.declaredFrames} ({stats.multiplier}×) · codec {stats.codec}
			</p>
			<p class="opacity-80">
				“0 seconds” duration in some players after optimize is normal — TikTok plays it fine.
			</p>
		</div>

		<ol class="list-decimal space-y-2 pl-5 text-sm leading-relaxed opacity-90">
			<li>Download the optimized file.</li>
			<li>
				Open TikTok <strong>web / Studio</strong> (not the phone gallery upload).
			</li>
			<li>Enable <strong>Upload HD</strong> / high-quality uploads.</li>
			<li>Set visibility to <strong>Everyone</strong> — don’t edit after upload.</li>
			<li>
				<strong>iOS:</strong> upload from Files, not Photos (keeps 60/120 fps).
			</li>
		</ol>
	{/if}

	{#if errorMessage}
		<div role="alert" class="alert alert-error">
			<span>{errorMessage}</span>
		</div>
	{/if}

	<div
		class="app-sticky-bar -mx-4 flex flex-col gap-2 px-4 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
	>
		{#if phase === 'ready' && optimizedBlob}
			<button type="button" class="btn btn-primary btn-lg app-touch ripple w-full" onclick={downloadOptimized}>
				Download optimized video
			</button>
			<button type="button" class="btn btn-outline app-touch w-full" onclick={openTikTokUpload}>
				Open TikTok Studio upload
			</button>
			<button type="button" class="btn btn-ghost app-touch w-full" onclick={runOptimize}>
				Optimize again
			</button>
		{:else}
			<button
				type="button"
				class="btn btn-primary btn-lg app-touch ripple w-full"
				disabled={!file || phase === 'optimizing' || phase === 'probing'}
				onclick={runOptimize}
			>
				{phase === 'optimizing' ? 'Optimizing…' : 'Optimize for near-original quality'}
			</button>
		{/if}
	</div>

	<p class="text-xs opacity-60">
		Prefer API Direct Post instead?
		<a href="/studio" class="link">Open Studio</a>
		(requires TikTok login; usually more compression, especially Only me).
	</p>
</article>

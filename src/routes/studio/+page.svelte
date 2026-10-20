<script lang="ts">
	import { formatBytes, formatDuration, formatResolution } from '#lib/format';
	import { PRIVACY_LABELS } from '#lib/upload/limits';
	import { pickUploadMime, uploadChunks, type ChunkProgress } from '#lib/upload/chunks';
	import { probeVideo, type VideoProbe } from '#lib/upload/probe';
	import { validateForTikTok, type ValidationIssue } from '#lib/upload/validate';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let file = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let probe = $state<VideoProbe | null>(null);
	let issues = $state<ValidationIssue[]>([]);
	let title = $state('');
	/** No default — TikTok requires manual privacy selection */
	let privacyLevel = $state('');
	let consent = $state(false);
	let allowComment = $state(false);
	let allowDuet = $state(false);
	let allowStitch = $state(false);
	let commercialDisclosure = $state(false);
	let brandOrganicToggle = $state(false);
	let brandContentToggle = $state(false);
	let isAigc = $state(false);

	let phase = $state<'idle' | 'probing' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
	let progressPct = $state(0);
	let progressLabel = $state('');
	let statusMessage = $state('');
	let lastPublishId = $state('');
	let statusDetail = $state('');
	let errorMessage = $state('');
	let abortController = $state<AbortController | null>(null);

	const hasErrors = $derived(issues.some((i) => i.level === 'error'));
	const maxDuration = $derived(data.creator?.max_video_post_duration_sec ?? 60);
	const commentLockedOff = $derived(Boolean(data.creator?.comment_disabled));
	const duetLockedOff = $derived(Boolean(data.creator?.duet_disabled));
	const stitchLockedOff = $derived(Boolean(data.creator?.stitch_disabled));

	const commercialIncomplete = $derived(
		commercialDisclosure && !brandOrganicToggle && !brandContentToggle
	);
	const brandedBlocksPrivate = $derived(
		commercialDisclosure && brandContentToggle && privacyLevel === 'SELF_ONLY'
	);

	const consentLabel = $derived.by(() => {
		if (commercialDisclosure && brandContentToggle) {
			return 'By posting, you agree to TikTok’s Branded Content Policy and Music Usage Confirmation.';
		}
		return 'By posting, you agree to TikTok’s Music Usage Confirmation.';
	});

	const canPublish = $derived(
		Boolean(file) &&
			Boolean(privacyLevel) &&
			consent &&
			!hasErrors &&
			!commercialIncomplete &&
			!brandedBlocksPrivate &&
			phase !== 'probing' &&
			phase !== 'processing' &&
			phase !== 'uploading'
	);

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
		issues = [];
		progressPct = 0;
		statusMessage = '';
		errorMessage = '';
		phase = 'idle';

		if (!next) return;

		previewUrl = URL.createObjectURL(next);
		phase = 'probing';
		try {
			const p = await probeVideo(next);
			probe = p;
			issues = validateForTikTok(p, maxDuration);
			phase = 'idle';
		} catch (err) {
			phase = 'error';
			errorMessage = err instanceof Error ? err.message : 'Could not probe video';
			probe = {
				name: next.name,
				size: next.size,
				mimeType: next.type || 'application/octet-stream',
				width: null,
				height: null,
				durationSec: null,
				fps: null
			};
			issues = validateForTikTok(probe, maxDuration);
		}
	}

	async function pollStatus(publishId: string): Promise<string> {
		for (let i = 0; i < 90; i++) {
			const res = await fetch('/api/publish/status', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ publishId })
			});
			const json = await res.json();
			if (!json.ok) {
				throw new Error(json.error || 'Status check failed');
			}
			const status = json.data.status as string;
			statusMessage = status;
			progressLabel = `TikTok status: ${status}`;
			if (status === 'PUBLISH_COMPLETE') return status;
			if (status === 'FAILED') {
				throw new Error(json.data.fail_reason || 'Publish failed');
			}
			await new Promise((r) => setTimeout(r, 2000));
		}
		throw new Error(`Timed out (last status: ${statusMessage || 'unknown'}).`);
	}

	async function startUpload() {
		if (!canPublish || !file || !probe) return;

		errorMessage = '';
		phase = 'uploading';
		progressPct = 0;
		progressLabel = 'Starting…';
		abortController = new AbortController();

		const beforeUnload = (e: BeforeUnloadEvent) => {
			e.preventDefault();
			e.returnValue = '';
		};
		window.addEventListener('beforeunload', beforeUnload);

		try {
			const initRes = await fetch('/api/publish/init', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title,
					privacyLevel,
					disableDuet: duetLockedOff || !allowDuet,
					disableStitch: stitchLockedOff || !allowStitch,
					disableComment: commentLockedOff || !allowComment,
					brandContentToggle: commercialDisclosure && brandContentToggle,
					brandOrganicToggle: commercialDisclosure && brandOrganicToggle,
					isAigc,
					videoSize: file.size,
					consent: true,
					durationSec: probe.durationSec
				})
			});
			const initJson = await initRes.json();
			if (!initJson.ok) {
				throw new Error(initJson.error || 'Init failed');
			}

			const { uploadUrl, publishId, chunkSize, totalChunkCount } = initJson.data;
			lastPublishId = publishId;
			const mimeType = pickUploadMime(file, probe.mimeType);

			await uploadChunks({
				file,
				uploadUrl,
				mimeType,
				chunkSize,
				totalChunkCount,
				signal: abortController.signal,
				onProgress: (p: ChunkProgress) => {
					progressPct = Math.round((p.bytesSent / p.totalBytes) * 100);
					progressLabel = `${formatBytes(p.bytesSent)} / ${formatBytes(p.totalBytes)} · chunk ${p.chunkIndex}/${p.totalChunks}`;
				}
			});

			phase = 'processing';
			progressLabel = 'Uploaded — waiting for TikTok to publish…';
			await pollStatus(publishId);
			phase = 'done';
			progressLabel = 'Published to TikTok';
		} catch (err) {
			if ((err as Error)?.name === 'AbortError') {
				errorMessage = 'Upload cancelled';
			} else {
				errorMessage = err instanceof Error ? err.message : 'Upload failed';
			}
			phase = 'error';
		} finally {
			window.removeEventListener('beforeunload', beforeUnload);
			abortController = null;
		}
	}

	function cancelUpload() {
		abortController?.abort();
	}

	async function refreshStatus() {
		if (!lastPublishId) return;
		statusDetail = 'Checking…';
		const res = await fetch('/api/publish/status', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ publishId: lastPublishId })
		});
		const json = await res.json();
		if (!json.ok) {
			statusDetail = json.error || 'Status check failed';
			return;
		}
		statusMessage = json.data.status;
		statusDetail = JSON.stringify(json.data, null, 2);
		if (json.data.fail_reason) {
			errorMessage = json.data.fail_reason;
		}
	}
</script>

{#if data.loadError || !data.creator}
	<article class="wash-panel paper-grain space-y-4">
		<h1 class="text-2xl font-semibold">Studio</h1>
		<div role="alert" class="alert alert-error">
			<span>{data.loadError ?? 'Could not load creator info.'}</span>
		</div>
		<a href="/auth/logout" class="btn btn-outline app-touch">Disconnect</a>
		<a href="/auth/tiktok" class="btn btn-primary app-touch">Connect TikTok</a>
	</article>
{:else}
	<article class="wash-panel paper-grain space-y-6 pb-28 sm:pb-8">
		<div class="flex items-center gap-3">
			{#if data.creator.creator_avatar_url}
				<img
					src={data.creator.creator_avatar_url}
					alt=""
					class="h-12 w-12 rounded-full object-cover"
					width="48"
					height="48"
				/>
			{/if}
			<div class="min-w-0">
				<h1 class="truncate text-xl font-semibold sm:text-2xl">Direct Post (API)</h1>
				<p class="truncate text-sm opacity-70">
					Posting as <strong>{data.creator.creator_nickname}</strong>
					(@{data.creator.creator_username}) · for near-original quality use
					<a href="/optimize" class="link">Optimize</a>
				</p>
			</div>
		</div>

		<div role="status" class="alert alert-warning text-sm">
			<span>
				Sandbox / unaudited Direct Post: set your <strong>TikTok account to Private</strong> in the
				TikTok app, and choose <strong>Only me</strong> here. Processing can take a few minutes.
			</span>
		</div>

		<label class="app-file-hit w-full">
			<input
				type="file"
				accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
				class="sr-only"
				onchange={onFileChange}
			/>
			<span class="font-medium">Choose original video</span>
			<span class="text-sm opacity-70">MP4 / MOV / WebM · full quality passthrough</span>
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
					<span>Resolution</span>
					<strong>{formatResolution(probe.width, probe.height)}</strong>
				</div>
				<div class="app-meta-item">
					<span>FPS</span>
					<strong>{probe.fps ?? 'Unknown (kept)'}</strong>
				</div>
				<div class="app-meta-item">
					<span>Duration</span>
					<strong>{formatDuration(probe.durationSec)}</strong>
				</div>
				<div class="app-meta-item">
					<span>Size</span>
					<strong>{formatBytes(probe.size)}</strong>
				</div>
			</div>
			<p class="text-xs opacity-60">Max duration for this account: {maxDuration}s</p>
		{/if}

		{#if issues.length}
			<ul class="space-y-2 text-sm">
				{#each issues as issue (issue.message)}
					<li class={issue.level === 'error' ? 'alert alert-error' : 'alert alert-warning'}>
						<span>{issue.message}</span>
					</li>
				{/each}
			</ul>
		{/if}

		<label class="form-control w-full">
			<span class="label"><span class="label-text">Title / caption</span></span>
			<textarea
				class="textarea textarea-bordered min-h-24 w-full text-base"
				bind:value={title}
				maxlength="2200"
				placeholder="Caption, #hashtags, @mentions"
			></textarea>
		</label>

		<label class="form-control w-full">
			<span class="label"><span class="label-text">Who can view this video</span></span>
			<select class="select select-bordered w-full app-touch text-base" bind:value={privacyLevel} required>
				<option value="" disabled>Select who can view</option>
				{#each data.creator.privacy_level_options as opt (opt)}
					<option
						value={opt}
						disabled={commercialDisclosure && brandContentToggle && opt === 'SELF_ONLY'}
					>
						{PRIVACY_LABELS[opt] ?? opt}
					</option>
				{/each}
			</select>
		</label>

		<fieldset class="space-y-2">
			<legend class="text-sm font-medium">Allow interactions</legend>
			<p class="text-xs opacity-60">None are on by default (TikTok requirement).</p>
			<label class="label cursor-pointer justify-start gap-3 {commentLockedOff ? 'opacity-50' : ''}">
				<input
					type="checkbox"
					class="checkbox"
					bind:checked={allowComment}
					disabled={commentLockedOff}
				/>
				<span class="label-text">Allow comment</span>
			</label>
			<label class="label cursor-pointer justify-start gap-3 {duetLockedOff ? 'opacity-50' : ''}">
				<input type="checkbox" class="checkbox" bind:checked={allowDuet} disabled={duetLockedOff} />
				<span class="label-text">Allow Duet</span>
			</label>
			<label class="label cursor-pointer justify-start gap-3 {stitchLockedOff ? 'opacity-50' : ''}">
				<input
					type="checkbox"
					class="checkbox"
					bind:checked={allowStitch}
					disabled={stitchLockedOff}
				/>
				<span class="label-text">Allow Stitch</span>
			</label>
		</fieldset>

		<fieldset class="space-y-3 rounded-lg border border-ink-border/15 p-3">
			<label class="label cursor-pointer justify-start gap-3">
				<input type="checkbox" class="toggle" bind:checked={commercialDisclosure} />
				<span class="label-text">Disclose commercial content</span>
			</label>
			{#if commercialDisclosure}
				<label class="label cursor-pointer justify-start gap-3">
					<input type="checkbox" class="checkbox" bind:checked={brandOrganicToggle} />
					<span class="label-text">Your brand</span>
				</label>
				{#if brandOrganicToggle && !brandContentToggle}
					<p class="text-xs opacity-70">Labeled as “Promotional content”.</p>
				{/if}
				<label class="label cursor-pointer justify-start gap-3">
					<input type="checkbox" class="checkbox" bind:checked={brandContentToggle} />
					<span class="label-text">Branded content</span>
				</label>
				{#if brandContentToggle}
					<p class="text-xs opacity-70">Labeled as “Paid partnership”. Cannot be Only me.</p>
				{/if}
				{#if commercialIncomplete}
					<p class="text-sm text-warning">
						Indicate if your content promotes yourself, a third party, or both.
					</p>
				{/if}
			{/if}
		</fieldset>

		<label class="label cursor-pointer justify-start gap-3">
			<input type="checkbox" class="checkbox" bind:checked={isAigc} />
			<span class="label-text">AI-generated content</span>
		</label>

		<label
			class="label cursor-pointer items-start justify-start gap-3 rounded-lg border border-ink-border/15 p-3"
		>
			<input type="checkbox" class="checkbox mt-1" bind:checked={consent} />
			<span class="label-text text-sm leading-relaxed">
				{consentLabel}
				I consent to post this original video to TikTok via Tok4K.
				<a
					class="link"
					href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
					target="_blank"
					rel="noopener noreferrer">Music Usage Confirmation</a
				>
				{#if commercialDisclosure && brandContentToggle}
					·
					<a
						class="link"
						href="https://www.tiktok.com/legal/page/global/bc-policy/en"
						target="_blank"
						rel="noopener noreferrer">Branded Content Policy</a
					>
				{/if}
			</span>
		</label>

		{#if phase === 'uploading' || phase === 'processing'}
			<div class="space-y-2">
				<progress class="progress progress-primary w-full" value={progressPct} max="100"></progress>
				<p class="text-sm opacity-80">{progressLabel}</p>
				{#if statusMessage}
					<p class="text-xs opacity-60">Status: {statusMessage}</p>
				{/if}
			</div>
		{/if}

		{#if phase === 'done'}
			<div role="status" class="alert alert-success space-y-2">
				<p>
					TikTok accepted the post
					{#if lastPublishId}
						(<code class="text-xs break-all">{lastPublishId}</code>)
					{/if}.
				</p>
				<ul class="list-disc space-y-1 pl-5 text-sm">
					<li>Open the <strong>TikTok mobile app</strong> (not tiktok.com in a browser).</li>
					<li>Use the <strong>same account</strong> you connected here (@{data.creator.creator_username}).</li>
					<li>Account must stay <strong>Private</strong>; post visibility was <strong>Only me</strong>.</li>
					<li>Go to <strong>Profile → your posts</strong> and pull to refresh (can take several minutes).</li>
					<li>Only-you posts won’t show if you view the profile while logged out or as another user.</li>
				</ul>
				{#if lastPublishId}
					<button type="button" class="btn btn-sm btn-outline" onclick={refreshStatus}>
						Re-check TikTok status
					</button>
				{/if}
				{#if statusDetail}
					<pre class="mt-2 max-h-40 overflow-auto rounded bg-base-200 p-2 text-xs">{statusDetail}</pre>
				{/if}
			</div>
		{/if}

		{#if errorMessage}
			<div role="alert" class="alert alert-error">
				<span>{errorMessage}</span>
			</div>
		{/if}

		<div
			class="app-sticky-bar -mx-4 px-4 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
		>
			{#if phase === 'uploading'}
				<button type="button" class="btn btn-outline app-touch w-full" onclick={cancelUpload}>
					Cancel
				</button>
			{:else}
				<button
					type="button"
					class="btn btn-primary btn-lg app-touch ripple w-full"
					disabled={!canPublish}
					onclick={startUpload}
				>
					{phase === 'processing' ? 'Publishing…' : 'Post directly to TikTok'}
				</button>
			{/if}
		</div>
	</article>
{/if}

import { TIKTOK_LIMITS } from '#lib/upload/limits';
import type { VideoProbe } from '#lib/upload/probe';

export type ValidationIssue = {
	level: 'error' | 'warn';
	message: string;
};

export function validateForTikTok(
	probe: VideoProbe,
	maxDurationSec: number
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const allowed = TIKTOK_LIMITS.allowedMime as readonly string[];

	if (!allowed.includes(probe.mimeType)) {
		issues.push({
			level: 'error',
			message: `Unsupported type (${probe.mimeType}). Use MP4, MOV, or WebM.`
		});
	}

	if (probe.size > TIKTOK_LIMITS.maxBytes) {
		issues.push({
			level: 'error',
			message: `File is larger than TikTok’s 4 GB ingest limit.`
		});
	}

	if (probe.width != null && probe.height != null) {
		const { width, height } = probe;
		if (
			width < TIKTOK_LIMITS.minDimension ||
			height < TIKTOK_LIMITS.minDimension ||
			width > TIKTOK_LIMITS.maxDimension ||
			height > TIKTOK_LIMITS.maxDimension
		) {
			issues.push({
				level: 'error',
				message: `Resolution ${width}×${height} is outside TikTok’s ${TIKTOK_LIMITS.minDimension}–${TIKTOK_LIMITS.maxDimension}px window.`
			});
		}
	} else {
		issues.push({
			level: 'warn',
			message: 'Could not read resolution. File will still upload byte-for-byte.'
		});
	}

	if (probe.durationSec != null) {
		if (probe.durationSec > maxDurationSec) {
			issues.push({
				level: 'error',
				message: `Duration ${Math.round(probe.durationSec)}s exceeds this account’s max of ${maxDurationSec}s.`
			});
		}
	} else {
		issues.push({
			level: 'warn',
			message: 'Could not read duration. TikTok may reject if over account limit.'
		});
	}

	if (probe.fps != null) {
		if (probe.fps < TIKTOK_LIMITS.minFps || probe.fps > TIKTOK_LIMITS.maxFps) {
			issues.push({
				level: 'error',
				message: `FPS ${probe.fps} is outside TikTok’s ${TIKTOK_LIMITS.minFps}–${TIKTOK_LIMITS.maxFps} range.`
			});
		}
	} else {
		issues.push({
			level: 'warn',
			message: 'FPS unknown in browser — original frame rate is preserved on upload (no conversion).'
		});
	}

	return issues;
}

/**
 * Compute TikTok FILE_UPLOAD chunk plan from original file size only.
 * Never alters media bytes.
 *
 * Rules (TikTok Media Transfer Guide):
 * - &lt; 5MB: whole file, chunk_size = video_size, total_chunk_count = 1
 * - ≤ 64MB: whole file (allowed; simpler on mobile)
 * - &gt; 64MB: multi-chunk; total_chunk_count = floor(video_size / chunk_size); last chunk carries remainder
 */
export function planChunks(videoSize: number): {
	chunkSize: number;
	totalChunkCount: number;
} {
	if (videoSize <= 0) {
		throw new Error('Invalid video size');
	}

	if (videoSize <= TIKTOK_LIMITS.maxChunkBytes) {
		return { chunkSize: videoSize, totalChunkCount: 1 };
	}

	let chunkSize = TIKTOK_LIMITS.preferredChunkBytes;
	let totalChunkCount = Math.floor(videoSize / chunkSize);

	if (totalChunkCount > 1000) {
		chunkSize = Math.ceil(videoSize / 1000);
		chunkSize = Math.min(
			TIKTOK_LIMITS.maxChunkBytes,
			Math.max(TIKTOK_LIMITS.minChunkBytes, chunkSize)
		);
		totalChunkCount = Math.floor(videoSize / chunkSize);
	}

	if (totalChunkCount < 2) {
		chunkSize = TIKTOK_LIMITS.maxChunkBytes;
		totalChunkCount = Math.floor(videoSize / chunkSize);
	}

	return { chunkSize, totalChunkCount };
}

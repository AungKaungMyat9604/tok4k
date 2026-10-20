/**
 * Byte-exact chunked PUT of the original File via file.slice — no re-encode.
 */
import { TIKTOK_LIMITS } from '#lib/upload/limits';
import { planChunks } from '#lib/upload/validate';

export type ChunkProgress = {
	bytesSent: number;
	totalBytes: number;
	chunkIndex: number;
	totalChunks: number;
};

export type UploadChunksOptions = {
	file: File;
	uploadUrl: string;
	mimeType: string;
	chunkSize: number;
	totalChunkCount: number;
	onProgress?: (p: ChunkProgress) => void;
	signal?: AbortSignal;
	maxRetries?: number;
};

async function putWithRetry(
	url: string,
	body: Blob,
	headers: Record<string, string>,
	signal: AbortSignal | undefined,
	maxRetries: number
): Promise<Response> {
	let lastError: unknown;
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const res = await fetch(url, {
				method: 'PUT',
				headers,
				body,
				signal
			});
			if (res.status === 201 || res.status === 206) return res;
			if (res.status >= 500 && attempt < maxRetries) {
				await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
				continue;
			}
			const text = await res.text().catch(() => '');
			throw new Error(`Upload chunk failed (${res.status}): ${text || res.statusText}`);
		} catch (err) {
			lastError = err;
			if (signal?.aborted) throw err;
			if (attempt < maxRetries) {
				await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
				continue;
			}
		}
	}
	throw lastError instanceof Error ? lastError : new Error('Upload failed');
}

export function buildChunkPlan(fileSize: number) {
	return planChunks(fileSize);
}

/**
 * Upload original file bytes sequentially to TikTok's upload_url.
 */
export async function uploadChunks(options: UploadChunksOptions): Promise<void> {
	const {
		file,
		uploadUrl,
		mimeType,
		chunkSize,
		totalChunkCount,
		onProgress,
		signal,
		maxRetries = 3
	} = options;

	const totalBytes = file.size;

	for (let i = 0; i < totalChunkCount; i++) {
		const start = i * chunkSize;
		const end = i === totalChunkCount - 1 ? totalBytes : Math.min(start + chunkSize, totalBytes);
		// Quality hard rule: slice original File only — never canvas / MediaRecorder output.
		const blob = file.slice(start, end);
		const contentLength = end - start;

		await putWithRetry(
			uploadUrl,
			blob,
			{
				'Content-Type': mimeType,
				'Content-Length': String(contentLength),
				'Content-Range': `bytes ${start}-${end - 1}/${totalBytes}`
			},
			signal,
			maxRetries
		);

		onProgress?.({
			bytesSent: end,
			totalBytes,
			chunkIndex: i + 1,
			totalChunks: totalChunkCount
		});
	}
}

export function pickUploadMime(file: File, probedMime: string): string {
	if ((TIKTOK_LIMITS.allowedMime as readonly string[]).includes(probedMime)) {
		return probedMime;
	}
	const name = file.name.toLowerCase();
	if (name.endsWith('.mov')) return 'video/quicktime';
	if (name.endsWith('.webm')) return 'video/webm';
	return 'video/mp4';
}

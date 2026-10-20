/**
 * Quality passthrough: probe metadata only — never re-encode, resize, or change FPS.
 */
export type VideoProbe = {
	name: string;
	size: number;
	mimeType: string;
	width: number | null;
	height: number | null;
	durationSec: number | null;
	/** Null when the browser cannot determine FPS; file still uploads unchanged. */
	fps: number | null;
};

function extensionMime(name: string): string | null {
	const lower = name.toLowerCase();
	if (lower.endsWith('.mp4')) return 'video/mp4';
	if (lower.endsWith('.mov')) return 'video/quicktime';
	if (lower.endsWith('.webm')) return 'video/webm';
	return null;
}

export function resolveMime(file: File): string {
	if (file.type && file.type.startsWith('video/')) return file.type;
	return extensionMime(file.name) ?? 'application/octet-stream';
}

export async function probeVideo(file: File): Promise<VideoProbe> {
	const mimeType = resolveMime(file);
	const url = URL.createObjectURL(file);

	try {
		const meta = await new Promise<{
			width: number;
			height: number;
			duration: number;
		}>((resolve, reject) => {
			const video = document.createElement('video');
			video.preload = 'metadata';
			video.muted = true;
			video.playsInline = true;

			const cleanup = () => {
				video.removeAttribute('src');
				video.load();
			};

			video.onloadedmetadata = () => {
				const width = video.videoWidth || 0;
				const height = video.videoHeight || 0;
				const duration = Number.isFinite(video.duration) ? video.duration : 0;
				cleanup();
				resolve({ width, height, duration });
			};
			video.onerror = () => {
				cleanup();
				reject(new Error('Could not read video metadata. The original file can still be uploaded if TikTok accepts it.'));
			};
			video.src = url;
		});

		return {
			name: file.name,
			size: file.size,
			mimeType,
			width: meta.width || null,
			height: meta.height || null,
			durationSec: meta.duration || null,
			fps: null
		};
	} finally {
		URL.revokeObjectURL(url);
	}
}

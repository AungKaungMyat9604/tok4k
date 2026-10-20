import { inflateSampleTableVideo } from './mp4-inflate';
import { normalizeContainer } from './mp4-normalize';

export const DEFAULT_INFLATE_MULTIPLIER = 10;
export const TIKTOK_WEB_UPLOAD_URL = 'https://www.tiktok.com/tiktokstudio/upload';

export type OptimizeStats = {
	inputBytes: number;
	outputBytes: number;
	originalFrames: number;
	declaredFrames: number;
	multiplier: number;
	codec: string;
	normalized: boolean;
	outputName: string;
};

export type OptimizeResult = {
	blob: Blob;
	stats: OptimizeStats;
};

function outputFileName(name: string): string {
	const base = name.replace(/\.[^.]+$/, '') || 'video';
	return `${base}-tok4k.mp4`;
}

/**
 * Client-side MP4/MOV prep for near-original TikTok delivery:
 * 1) normalize container (isom + moov before mdat)
 * 2) inflate declared frame density (no pixel re-encode)
 * Then upload via TikTok web / Studio with Upload HD + public visibility.
 */
export async function optimizeForTikTok(
	file: File,
	multiplier = DEFAULT_INFLATE_MULTIPLIER
): Promise<OptimizeResult> {
	const lower = file.name.toLowerCase();
	if (!lower.endsWith('.mp4') && !lower.endsWith('.mov') && !file.type.includes('mp4') && !file.type.includes('quicktime')) {
		throw new Error('Use MP4 or MOV (H.264 / H.265). WebM is not supported for density optimize.');
	}

	const inputBytes = new Uint8Array(await file.arrayBuffer());
	const inputView = new DataView(inputBytes.buffer, inputBytes.byteOffset, inputBytes.byteLength);

	const normalized = normalizeContainer(inputBytes, inputView);
	if (!normalized.valid) {
		throw new Error('Invalid MP4/MOV — missing moov box. Re-export as MP4 and try again.');
	}

	const inflated = inflateSampleTableVideo(normalized.bytes, normalized.view, multiplier);

	const copy = inflated.bytes.slice();
	const blob = new Blob([copy], { type: 'video/mp4' });
	return {
		blob,
		stats: {
			inputBytes: file.size,
			outputBytes: inflated.bytes.byteLength,
			originalFrames: inflated.originalFrames,
			declaredFrames: inflated.declaredFrames,
			multiplier: inflated.multiplier,
			codec: inflated.codec,
			normalized: normalized.changed,
			outputName: outputFileName(file.name)
		}
	};
}

export function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.rel = 'noopener';
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

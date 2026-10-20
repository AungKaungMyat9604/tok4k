import type { SessionData } from '#lib/server/session';
import { refreshAccessToken } from '#lib/server/tiktok/oauth';

const API_BASE = 'https://open.tiktokapis.com';

export type CreatorInfo = {
	creator_avatar_url: string;
	creator_username: string;
	creator_nickname: string;
	privacy_level_options: string[];
	comment_disabled: boolean;
	duet_disabled: boolean;
	stitch_disabled: boolean;
	max_video_post_duration_sec: number;
};

export type PublishInitResult = {
	publish_id: string;
	upload_url: string;
};

export type PublishStatus = {
	status: string;
	fail_reason?: string;
	publicaly_available_post_id?: string[];
	uploaded_bytes?: number;
};

type TikTokEnvelope<T> = {
	data?: T;
	error?: { code: string; message: string; log_id?: string };
};

async function tiktokFetch<T>(
	path: string,
	accessToken: string,
	init?: RequestInit
): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json; charset=UTF-8',
			...(init?.headers ?? {})
		}
	});

	const json = (await res.json()) as TikTokEnvelope<T>;
	const code = json.error?.code ?? 'unknown';
	if (code !== 'ok') {
		const message = json.error?.message || code;
		const err = new Error(message);
		(err as Error & { code: string; status: number }).code = code;
		(err as Error & { code: string; status: number }).status = res.status;
		throw err;
	}
	return json.data as T;
}

/** Refresh token if access token expires within 2 minutes. */
export async function ensureFreshSession(session: SessionData): Promise<{
	session: SessionData;
	refreshed: boolean;
}> {
	if (Date.now() < session.accessExpiresAt - 120_000) {
		return { session, refreshed: false };
	}
	if (Date.now() >= session.refreshExpiresAt) {
		throw new Error('Session expired. Please connect TikTok again.');
	}
	const next = await refreshAccessToken(session.refreshToken);
	return { session: next, refreshed: true };
}

export async function queryCreatorInfo(accessToken: string): Promise<CreatorInfo> {
	return tiktokFetch<CreatorInfo>('/v2/post/publish/creator_info/query/', accessToken, {
		method: 'POST',
		body: '{}'
	});
}

export type InitPublishInput = {
	title: string;
	privacyLevel: string;
	disableDuet: boolean;
	disableStitch: boolean;
	disableComment: boolean;
	brandContentToggle: boolean;
	brandOrganicToggle: boolean;
	isAigc: boolean;
	videoSize: number;
	chunkSize: number;
	totalChunkCount: number;
};

export async function initVideoPublish(
	accessToken: string,
	input: InitPublishInput
): Promise<PublishInitResult> {
	return tiktokFetch<PublishInitResult>('/v2/post/publish/video/init/', accessToken, {
		method: 'POST',
		body: JSON.stringify({
			post_info: {
				title: input.title,
				privacy_level: input.privacyLevel,
				disable_duet: input.disableDuet,
				disable_stitch: input.disableStitch,
				disable_comment: input.disableComment,
				brand_content_toggle: input.brandContentToggle,
				brand_organic_toggle: input.brandOrganicToggle,
				is_aigc: input.isAigc
			},
			source_info: {
				source: 'FILE_UPLOAD',
				video_size: input.videoSize,
				chunk_size: input.chunkSize,
				total_chunk_count: input.totalChunkCount
			}
		})
	});
}

/**
 * Upload-to-inbox (draft). Scope: video.upload.
 * User finishes caption/privacy in the TikTok app after an inbox notification.
 * Prefer this in sandbox when Direct Post / video.publish is blocked by guidelines audit.
 */
export async function initInboxVideoUpload(
	accessToken: string,
	input: { videoSize: number; chunkSize: number; totalChunkCount: number }
): Promise<PublishInitResult> {
	return tiktokFetch<PublishInitResult>('/v2/post/publish/inbox/video/init/', accessToken, {
		method: 'POST',
		body: JSON.stringify({
			source_info: {
				source: 'FILE_UPLOAD',
				video_size: input.videoSize,
				chunk_size: input.chunkSize,
				total_chunk_count: input.totalChunkCount
			}
		})
	});
}

export async function fetchPublishStatus(
	accessToken: string,
	publishId: string
): Promise<PublishStatus> {
	return tiktokFetch<PublishStatus>('/v2/post/publish/status/fetch/', accessToken, {
		method: 'POST',
		body: JSON.stringify({ publish_id: publishId })
	});
}

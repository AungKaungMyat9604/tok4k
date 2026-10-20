/** TikTok Content Posting API ingest limits — we never re-encode; we only validate. */
export const TIKTOK_LIMITS = {
	minDimension: 360,
	maxDimension: 4096,
	minFps: 23,
	maxFps: 60,
	maxBytes: 4 * 1024 * 1024 * 1024,
	maxDurationSecApi: 10 * 60,
	allowedMime: ['video/mp4', 'video/quicktime', 'video/webm'] as const,
	/** Prefer ~10MB chunks on mobile (within TikTok 5–64MB rules). */
	preferredChunkBytes: 10 * 1024 * 1024,
	minChunkBytes: 5 * 1024 * 1024,
	maxChunkBytes: 64 * 1024 * 1024
} as const;

export type PrivacyLevel =
	| 'PUBLIC_TO_EVERYONE'
	| 'MUTUAL_FOLLOW_FRIENDS'
	| 'FOLLOWER_OF_CREATOR'
	| 'SELF_ONLY';

export const PRIVACY_LABELS: Record<string, string> = {
	PUBLIC_TO_EVERYONE: 'Everyone',
	MUTUAL_FOLLOW_FRIENDS: 'Friends',
	FOLLOWER_OF_CREATOR: 'Followers',
	SELF_ONLY: 'Only me'
};

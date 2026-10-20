import {
	SESSION_SECRET,
	TIKTOK_CLIENT_KEY,
	TIKTOK_CLIENT_SECRET,
	TIKTOK_REDIRECT_URI,
	TIKTOK_SCOPES
} from '$app/env/private';

function required(name: string, value: string | undefined): string {
	if (!value) {
		throw new Error(`Missing environment variable: ${name}`);
	}
	return value;
}

/** Direct Post requires video.publish (and Direct Post enabled on the TikTok app). */
export function getTikTokConfig() {
	return {
		clientKey: required('TIKTOK_CLIENT_KEY', TIKTOK_CLIENT_KEY),
		clientSecret: required('TIKTOK_CLIENT_SECRET', TIKTOK_CLIENT_SECRET),
		redirectUri: required('TIKTOK_REDIRECT_URI', TIKTOK_REDIRECT_URI),
		scopes: (TIKTOK_SCOPES ?? 'user.info.basic,video.publish')
			.split(',')
			.map((s: string) => s.trim())
	};
}

export function getSessionSecret(): string {
	return required('SESSION_SECRET', SESSION_SECRET);
}

export function hasTikTokConfig(): boolean {
	return Boolean(TIKTOK_CLIENT_KEY && TIKTOK_CLIENT_SECRET && TIKTOK_REDIRECT_URI && SESSION_SECRET);
}

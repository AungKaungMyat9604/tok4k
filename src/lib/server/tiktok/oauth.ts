import { getTikTokConfig } from '#lib/server/env';
import type { SessionData } from '#lib/server/session';

const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';

type TokenResponse = {
	open_id?: string;
	scope?: string;
	access_token?: string;
	expires_in?: number;
	refresh_token?: string;
	refresh_expires_in?: number;
	token_type?: string;
	error?: string;
	error_description?: string;
};

function toSession(tokens: TokenResponse): SessionData {
	if (!tokens.access_token || !tokens.refresh_token || !tokens.open_id) {
		throw new Error(tokens.error_description || tokens.error || 'Invalid token response from TikTok');
	}
	const now = Date.now();
	return {
		accessToken: tokens.access_token,
		refreshToken: tokens.refresh_token,
		openId: tokens.open_id,
		accessExpiresAt: now + (tokens.expires_in ?? 86400) * 1000,
		refreshExpiresAt: now + (tokens.refresh_expires_in ?? 365 * 86400) * 1000,
		scope: tokens.scope ?? ''
	};
}

export function buildAuthorizeUrl(state: string): string {
	const { clientKey, redirectUri, scopes } = getTikTokConfig();
	const params = new URLSearchParams({
		client_key: clientKey,
		response_type: 'code',
		scope: scopes.join(','),
		redirect_uri: redirectUri,
		state
	});
	return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<SessionData> {
	const { clientKey, clientSecret, redirectUri } = getTikTokConfig();
	const body = new URLSearchParams({
		client_key: clientKey,
		client_secret: clientSecret,
		code,
		grant_type: 'authorization_code',
		redirect_uri: redirectUri
	});

	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Cache-Control': 'no-cache'
		},
		body
	});

	const json = (await res.json()) as TokenResponse;
	if (!res.ok) {
		throw new Error(json.error_description || json.error || `Token exchange failed (${res.status})`);
	}
	return toSession(json);
}

export async function refreshAccessToken(refreshToken: string): Promise<SessionData> {
	const { clientKey, clientSecret } = getTikTokConfig();
	const body = new URLSearchParams({
		client_key: clientKey,
		client_secret: clientSecret,
		grant_type: 'refresh_token',
		refresh_token: refreshToken
	});

	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Cache-Control': 'no-cache'
		},
		body
	});

	const json = (await res.json()) as TokenResponse;
	if (!res.ok) {
		throw new Error(json.error_description || json.error || `Token refresh failed (${res.status})`);
	}
	return toSession(json);
}

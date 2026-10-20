import { getSessionSecret } from '#lib/server/env';
import type { Cookies } from '@sveltejs/kit';

const COOKIE_NAME = 'tfq_session';
const CSRF_COOKIE = 'tfq_oauth_state';
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days (refresh keeps access alive)

export type SessionData = {
	accessToken: string;
	refreshToken: string;
	openId: string;
	accessExpiresAt: number;
	refreshExpiresAt: number;
	scope: string;
};

function bytesToBase64Url(bytes: Uint8Array): string {
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
	const padded = value.replace(/-/g, '+').replace(/_/g, '/');
	const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
	const bin = atob(padded + pad);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
	const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
	return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function seal(data: SessionData): Promise<string> {
	const key = await deriveKey(getSessionSecret());
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const plaintext = new TextEncoder().encode(JSON.stringify(data));
	const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
	return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(cipher))}`;
}

async function unseal(token: string): Promise<SessionData | null> {
	try {
		const [ivPart, dataPart] = token.split('.');
		if (!ivPart || !dataPart) return null;
		const key = await deriveKey(getSessionSecret());
		const iv = base64UrlToBytes(ivPart);
		const cipher = base64UrlToBytes(dataPart);
		const plain = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: iv as BufferSource },
			key,
			cipher as BufferSource
		);
		return JSON.parse(new TextDecoder().decode(plain)) as SessionData;
	} catch {
		return null;
	}
}

export async function setSession(cookies: Cookies, data: SessionData): Promise<void> {
	const value = await seal(data);
	cookies.set(COOKIE_NAME, value, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: MAX_AGE_SEC
	});
}

export async function clearSession(cookies: Cookies): Promise<void> {
	cookies.delete(COOKIE_NAME, { path: '/' });
}

export async function readSession(cookies: Cookies): Promise<SessionData | null> {
	const raw = cookies.get(COOKIE_NAME);
	if (!raw) return null;
	return unseal(raw);
}

export function setOAuthState(cookies: Cookies, state: string): void {
	cookies.set(CSRF_COOKIE, state, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: 600
	});
}

export function consumeOAuthState(cookies: Cookies): string | undefined {
	const state = cookies.get(CSRF_COOKIE);
	cookies.delete(CSRF_COOKIE, { path: '/' });
	return state;
}

/** Dev localhost may not be https — allow insecure cookies only on localhost. */
export function cookieSecureForUrl(url: URL): boolean {
	return url.hostname !== 'localhost' && url.hostname !== '127.0.0.1';
}

export async function setSessionForRequest(
	cookies: Cookies,
	data: SessionData,
	url: URL
): Promise<void> {
	const value = await seal(data);
	cookies.set(COOKIE_NAME, value, {
		path: '/',
		httpOnly: true,
		secure: cookieSecureForUrl(url),
		sameSite: 'lax',
		maxAge: MAX_AGE_SEC
	});
}

export function setOAuthStateForRequest(cookies: Cookies, state: string, url: URL): void {
	cookies.set(CSRF_COOKIE, state, {
		path: '/',
		httpOnly: true,
		secure: cookieSecureForUrl(url),
		sameSite: 'lax',
		maxAge: 600
	});
}

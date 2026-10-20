import { clearSession, readSession, setSessionForRequest, type SessionData } from '#lib/server/session';
import { ensureFreshSession } from '#lib/server/tiktok/api';
import type { Cookies } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';

export async function getValidSession(
	cookies: Cookies,
	url: URL
): Promise<SessionData | null> {
	const current = await readSession(cookies);
	if (!current) return null;

	try {
		const { session, refreshed } = await ensureFreshSession(current);
		if (refreshed) {
			await setSessionForRequest(cookies, session, url);
		}
		return session;
	} catch {
		await clearSession(cookies);
		return null;
	}
}

export async function requireSession(cookies: Cookies, url: URL): Promise<SessionData> {
	const session = await getValidSession(cookies, url);
	if (!session) {
		redirect(303, '/?error=auth');
	}
	return session;
}

export async function requireSessionApi(cookies: Cookies, url: URL): Promise<SessionData> {
	const session = await getValidSession(cookies, url);
	if (!session) {
		error(401, 'Not signed in with TikTok');
	}
	return session;
}

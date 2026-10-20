import { hasTikTokConfig } from '#lib/server/env';
import { consumeOAuthState, setSessionForRequest } from '#lib/server/session';
import { exchangeCodeForTokens } from '#lib/server/tiktok/oauth';
import { isRedirect, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!hasTikTokConfig()) {
		redirect(303, '/?error=config');
	}

	const errorParam = url.searchParams.get('error');
	if (errorParam) {
		redirect(303, `/?error=oauth&detail=${encodeURIComponent(errorParam)}`);
	}

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const expected = consumeOAuthState(cookies);

	if (!code || !state || !expected || state !== expected) {
		redirect(303, '/?error=state');
	}

	try {
		const session = await exchangeCodeForTokens(code);
		await setSessionForRequest(cookies, session, url);
		redirect(303, '/studio');
	} catch (err) {
		if (isRedirect(err)) throw err;
		const message = err instanceof Error ? err.message : 'oauth_failed';
		redirect(303, `/?error=token&detail=${encodeURIComponent(message)}`);
	}
};

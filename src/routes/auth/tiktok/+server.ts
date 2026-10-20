import { hasTikTokConfig } from '#lib/server/env';
import { setOAuthStateForRequest } from '#lib/server/session';
import { buildAuthorizeUrl } from '#lib/server/tiktok/oauth';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
	if (!hasTikTokConfig()) {
		redirect(303, '/?error=config');
	}

	const state = crypto.randomUUID();
	setOAuthStateForRequest(cookies, state, url);
	// SvelteKit 3 blocks external redirects unless opted in
	redirect(302, buildAuthorizeUrl(state), { external: ['https://www.tiktok.com'] });
};

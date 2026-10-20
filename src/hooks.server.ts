import { hasTikTokConfig } from '#lib/server/env';
import { getValidSession } from '#lib/server/auth';
import type { Handle } from '@sveltejs/kit/hooks';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.tiktokConfigured = hasTikTokConfig();
	try {
		event.locals.session = event.locals.tiktokConfigured
			? await getValidSession(event.cookies, event.url)
			: null;
	} catch {
		event.locals.session = null;
	}
	return resolve(event);
};

import { requireSessionApi } from '#lib/server/auth';
import { queryCreatorInfo } from '#lib/server/tiktok/api';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const session = await requireSessionApi(cookies, url);
	try {
		const data = await queryCreatorInfo(session.accessToken);
		return json({ ok: true, data });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to load creator info';
		const code = (err as { code?: string }).code;
		return json({ ok: false, error: message, code }, { status: 400 });
	}
};

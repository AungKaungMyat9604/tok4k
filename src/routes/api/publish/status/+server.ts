import { requireSessionApi } from '#lib/server/auth';
import { fetchPublishStatus } from '#lib/server/tiktok/api';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	const session = await requireSessionApi(cookies, url);
	const body = (await request.json()) as { publishId?: string };
	if (!body.publishId) {
		return json({ ok: false, error: 'publishId is required' }, { status: 400 });
	}

	try {
		const data = await fetchPublishStatus(session.accessToken, body.publishId);
		return json({ ok: true, data });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch status';
		const code = (err as { code?: string }).code;
		return json({ ok: false, error: message, code }, { status: 400 });
	}
};

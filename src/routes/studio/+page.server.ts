import { requireSession } from '#lib/server/auth';
import { queryCreatorInfo } from '#lib/server/tiktok/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const session = await requireSession(cookies, url);

	try {
		const creator = await queryCreatorInfo(session.accessToken);
		return {
			creator,
			loadError: null as string | null
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to load creator info';
		const code = (err as { code?: string }).code;
		const hint =
			code === 'scope_not_authorized'
				? ' Enable Direct Post + video.publish in the TikTok portal, Apply changes, then Disconnect and Connect again.'
				: '';
		return {
			creator: null,
			loadError: message + hint
		};
	}
};

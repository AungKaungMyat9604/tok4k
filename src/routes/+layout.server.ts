import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		signedIn: Boolean(locals.session),
		tiktokConfigured: locals.tiktokConfigured
	};
};

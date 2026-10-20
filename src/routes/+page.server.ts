import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const error = url.searchParams.get('error');
	const detail = url.searchParams.get('detail');

	const messages: Record<string, string> = {
		config: 'TikTok API credentials are not configured. Copy .env.example to .env and add your keys.',
		auth: 'Please connect your TikTok account to continue.',
		oauth: 'TikTok authorization was denied or failed.',
		state: 'OAuth state mismatch. Try connecting again.',
		token: 'Could not exchange the authorization code for tokens.'
	};

	return {
		signedIn: Boolean(locals.session),
		tiktokConfigured: locals.tiktokConfigured,
		errorMessage: error ? messages[error] ?? 'Something went wrong.' : null,
		errorDetail: detail
	};
};

import { defineEnvVars } from '@sveltejs/kit/env';

/** Explicit env declarations (SvelteKit 3). Values are read at runtime. */
export const variables = defineEnvVars({
	TIKTOK_CLIENT_KEY: {
		schema: (value: string | undefined) => value
	},
	TIKTOK_CLIENT_SECRET: {
		schema: (value: string | undefined) => value
	},
	TIKTOK_REDIRECT_URI: {
		schema: (value: string | undefined) => value
	},
	TIKTOK_SCOPES: {
		schema: (value: string | undefined) => value
	},
	SESSION_SECRET: {
		schema: (value: string | undefined) => value
	}
});

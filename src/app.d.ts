// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			session: import('./lib/server/session').SessionData | null;
			tiktokConfigured: boolean;
		}
	}
}

export {};

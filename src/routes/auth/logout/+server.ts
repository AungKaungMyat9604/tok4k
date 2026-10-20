import { clearSession } from '#lib/server/session';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	await clearSession(cookies);
	redirect(303, '/');
};

export const GET: RequestHandler = async ({ cookies }) => {
	await clearSession(cookies);
	redirect(303, '/');
};

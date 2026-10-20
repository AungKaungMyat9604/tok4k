import { requireSessionApi } from '#lib/server/auth';
import { initVideoPublish, queryCreatorInfo } from '#lib/server/tiktok/api';
import { TIKTOK_LIMITS } from '#lib/upload/limits';
import { planChunks } from '#lib/upload/validate';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Body = {
	title?: string;
	privacyLevel?: string;
	disableDuet?: boolean;
	disableStitch?: boolean;
	disableComment?: boolean;
	brandContentToggle?: boolean;
	brandOrganicToggle?: boolean;
	isAigc?: boolean;
	videoSize?: number;
	consent?: boolean;
	durationSec?: number;
};

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	const session = await requireSessionApi(cookies, url);
	const body = (await request.json()) as Body;

	if (!body.consent) {
		return json(
			{ ok: false, error: 'Explicit consent is required before uploading to TikTok.' },
			{ status: 400 }
		);
	}

	const videoSize = body.videoSize ?? 0;
	if (!Number.isFinite(videoSize) || videoSize <= 0 || videoSize > TIKTOK_LIMITS.maxBytes) {
		return json({ ok: false, error: 'Invalid video size.' }, { status: 400 });
	}

	const privacyLevel = body.privacyLevel;
	if (!privacyLevel) {
		return json({ ok: false, error: 'Privacy level is required.' }, { status: 400 });
	}

	try {
		const creator = await queryCreatorInfo(session.accessToken);
		if (!creator.privacy_level_options.includes(privacyLevel)) {
			return json(
				{ ok: false, error: 'Selected privacy level is not allowed for this account.' },
				{ status: 400 }
			);
		}

		if (
			body.durationSec != null &&
			Number.isFinite(body.durationSec) &&
			body.durationSec > creator.max_video_post_duration_sec
		) {
			return json(
				{
					ok: false,
					error: `Video exceeds max duration of ${creator.max_video_post_duration_sec}s for this account.`
				},
				{ status: 400 }
			);
		}

		const brandContentToggle = Boolean(body.brandContentToggle);
		const brandOrganicToggle = Boolean(body.brandOrganicToggle);
		if (brandContentToggle && privacyLevel === 'SELF_ONLY') {
			return json(
				{ ok: false, error: 'Branded content visibility cannot be set to private.' },
				{ status: 400 }
			);
		}

		const { chunkSize, totalChunkCount } = planChunks(videoSize);
		const title = (body.title ?? '').slice(0, 2200);

		const result = await initVideoPublish(session.accessToken, {
			title,
			privacyLevel,
			disableDuet: Boolean(body.disableDuet || creator.duet_disabled),
			disableStitch: Boolean(body.disableStitch || creator.stitch_disabled),
			disableComment: Boolean(body.disableComment || creator.comment_disabled),
			brandContentToggle,
			brandOrganicToggle,
			isAigc: Boolean(body.isAigc),
			videoSize,
			chunkSize,
			totalChunkCount
		});

		return json({
			ok: true,
			data: {
				publishId: result.publish_id,
				uploadUrl: result.upload_url,
				chunkSize,
				totalChunkCount,
				mode: 'direct'
			}
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to initialize publish';
		const code = (err as { code?: string }).code;
		let hint = '';
		if (code === 'unaudited_client_can_only_post_to_private_accounts') {
			hint =
				' Set your TikTok account to Private in the TikTok app, and choose Only me (SELF_ONLY).';
		}
		if (code === 'scope_not_authorized') {
			hint = ' Disconnect and Connect TikTok again after enabling video.publish + Direct Post.';
		}
		return json({ ok: false, error: message + hint, code }, { status: 400 });
	}
};

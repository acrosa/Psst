import { env } from './env.server';

type InviteEmailArgs = {
	to: string;
	inviterName: string | null;
	spaceName: string;
	spaceEmoji: string;
	url: string;
};

/**
 * Send an invite email. Console provider by default; Resend when configured.
 * Email is sugar on top of the copyable link — failures log, never throw.
 */
export async function sendInviteEmail({
	to,
	inviterName,
	spaceName,
	spaceEmoji,
	url,
}: InviteEmailArgs): Promise<void> {
	const inviter = inviterName ?? 'Someone';
	const subject = `${spaceEmoji} ${inviter} saved you a spot on "${spaceName}"`;
	const text = [
		`psst — ${inviter} invited you to share a little canvas called "${spaceName}".`,
		'',
		'Open your invite:',
		url,
		'',
		'Drop links, notes and photos on a shared board; every day becomes a page in your scrapbook.',
	].join('\n');
	const html = `
		<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 460px; margin: 0 auto; padding: 32px 24px; color: #40382f;">
			<div style="font-size: 40px; text-align: center;">${spaceEmoji}</div>
			<h1 style="font-size: 22px; text-align: center; font-weight: 600;">${inviter} saved you a spot</h1>
			<p style="font-size: 15px; line-height: 1.5; color: #8d8375; text-align: center;">
				You're invited to <strong style="color:#40382f;">${spaceName}</strong> — a little shared canvas on psst.
				Drop links, notes and photos on today's board; tomorrow it becomes a page in your scrapbook.
			</p>
			<p style="text-align: center; margin: 28px 0;">
				<a href="${url}" style="background: #e2725b; color: #fff; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-size: 15px; font-weight: 500;">Open your invite</a>
			</p>
			<p style="font-size: 12px; color: #c9bfae; text-align: center;">Not a chat. No pressure. Just keepsakes.</p>
		</div>`;

	await deliver({ to, subject, text, html, logHint: url });
}

type MentionEmailArgs = {
	to: string;
	actorName: string | null;
	spaceName: string;
	spaceEmoji: string;
	excerpt: string;
	url: string;
};

/** Someone was called by name — the one email psst sends besides invites. */
export async function sendMentionEmail({
	to,
	actorName,
	spaceName,
	spaceEmoji,
	excerpt,
	url,
}: MentionEmailArgs): Promise<void> {
	const actor = actorName ?? 'Someone';
	const subject = `${spaceEmoji} ${actor} mentioned you on "${spaceName}"`;
	const text = [
		`psst — ${actor} mentioned you on today's canvas in "${spaceName}":`,
		'',
		`“${excerpt}”`,
		'',
		'See it on the board:',
		url,
	].join('\n');
	const html = `
		<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 460px; margin: 0 auto; padding: 32px 24px; color: #40382f;">
			<div style="font-size: 40px; text-align: center;">${spaceEmoji}</div>
			<h1 style="font-size: 22px; text-align: center; font-weight: 600;">${actor} mentioned you</h1>
			<p style="font-size: 15px; line-height: 1.5; color: #8d8375; text-align: center;">
				On today's canvas in <strong style="color:#40382f;">${spaceName}</strong>:
			</p>
			<p style="font-size: 15px; line-height: 1.6; background: #faf6ef; border-radius: 10px; padding: 14px 18px; text-align: center;">“${excerpt}”</p>
			<p style="text-align: center; margin: 28px 0;">
				<a href="${url}" style="background: #e2725b; color: #fff; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-size: 15px; font-weight: 500;">Open the canvas</a>
			</p>
			<p style="font-size: 12px; color: #c9bfae; text-align: center;">You can turn mention emails off from your profile.</p>
		</div>`;
	await deliver({ to, subject, text, html, logHint: url });
}

type AcceptedEmailArgs = {
	to: string;
	name: string | null;
};

/** The email everyone on the list is waiting for. */
export async function sendAcceptedEmail({ to, name }: AcceptedEmailArgs): Promise<void> {
	const first = name?.split(/\s+/)[0];
	const subject = '🌷 psst — you\u2019re in';
	const url = 'https://www.psst.you/spaces';
	const text = [
		`psst${first ? ` ${first}` : ''} — your spot opened up.`,
		'',
		'Come make your first canvas:',
		url,
		'',
		'Drop links, notes and photos on a shared board; every day becomes a page in your scrapbook.',
	].join('\n');
	const html = `
		<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 460px; margin: 0 auto; padding: 32px 24px; color: #40382f;">
			<div style="font-size: 40px; text-align: center;">🌷</div>
			<h1 style="font-size: 22px; text-align: center; font-weight: 600;">You\u2019re in</h1>
			<p style="font-size: 15px; line-height: 1.5; color: #8d8375; text-align: center;">
				psst${first ? ` ${first}` : ''} — your spot opened up. A little shared canvas for the people you whisper to.
			</p>
			<p style="text-align: center; margin: 28px 0;">
				<a href="${url}" style="background: #e2725b; color: #fff; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-size: 15px; font-weight: 500;">Open psst</a>
			</p>
			<p style="font-size: 12px; color: #c9bfae; text-align: center;">Not a chat. No pressure. Just keepsakes.</p>
		</div>`;
	await deliver({ to, subject, text, html, logHint: url });
}

type ResetEmailArgs = {
	to: string;
	name: string | null;
	url: string;
};

/** The way back in — a link that works once, for an hour. */
export async function sendResetPasswordEmail({ to, name, url }: ResetEmailArgs): Promise<void> {
	const first = name?.split(/\s+/)[0];
	const subject = 'psst — a new password';
	const text = [
		`psst${first ? ` ${first}` : ''} — someone (hopefully you) asked to reset your password.`,
		'',
		'Choose a new one:',
		url,
		'',
		'The link works once, within the hour. If this wasn\u2019t you, ignore this — nothing changes.',
	].join('\n');
	const html = `
		<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 460px; margin: 0 auto; padding: 32px 24px; color: #40382f;">
			<div style="font-size: 40px; text-align: center;">🔑</div>
			<h1 style="font-size: 22px; text-align: center; font-weight: 600;">A new password</h1>
			<p style="font-size: 15px; line-height: 1.5; color: #8d8375; text-align: center;">
				Someone (hopefully you) asked to reset the password for <strong style="color:#40382f;">${to}</strong>.
			</p>
			<p style="text-align: center; margin: 28px 0;">
				<a href="${url}" style="background: #e2725b; color: #fff; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-size: 15px; font-weight: 500;">Choose a new password</a>
			</p>
			<p style="font-size: 12px; color: #c9bfae; text-align: center;">
				The link works once, within the hour. If this wasn\u2019t you, ignore this \u2014 nothing changes.
			</p>
		</div>`;
	await deliver({ to, subject, text, html, logHint: url });
}

async function deliver({
	to,
	subject,
	text,
	html,
	logHint,
}: {
	to: string;
	subject: string;
	text: string;
	html: string;
	logHint: string;
}): Promise<void> {
	if (!env.RESEND_API_KEY) {
		console.log(`[email] (console mode) to=${to} subject=${JSON.stringify(subject)}\n  ${logHint}`);
		return;
	}

	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${env.RESEND_API_KEY}`,
			},
			body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, html, text }),
		});
		if (!response.ok) {
			console.error(`[email] Resend responded ${response.status}: ${await response.text()}`);
		}
	} catch (error) {
		console.error('[email] send failed:', error);
	}
}

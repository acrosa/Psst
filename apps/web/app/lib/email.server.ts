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

	if (!env.RESEND_API_KEY) {
		console.log(`[email] (console mode) to=${to} subject=${JSON.stringify(subject)}\n  ${url}`);
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

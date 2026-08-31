/**
 * The two people holding the door. Admins bypass the waitlist and can accept
 * people in from /admin.
 */
const ADMIN_EMAILS = ['alejandro.crosa@gmail.com', 'bren.mzn@gmail.com'];

export function isAdminEmail(email: string | null | undefined): boolean {
	return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

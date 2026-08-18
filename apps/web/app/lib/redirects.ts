/** Only allow same-origin path redirects (guards ?next= against open redirects). */
export function safeNext(next: string | null | undefined, fallback = '/spaces'): string {
	if (next?.startsWith('/') && !next.startsWith('//')) {
		return next;
	}
	return fallback;
}

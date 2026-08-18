/**
 * Timezone-aware day math for the daily canvas, using Intl only (no date deps).
 * Canvas dates are 'YYYY-MM-DD' strings in the space's IANA timezone.
 */

/** Today's date string in the given timezone (falls back to UTC when invalid). */
export function localDate(timezone: string, at: Date = new Date()): string {
	try {
		// en-CA formats dates as YYYY-MM-DD
		return new Intl.DateTimeFormat('en-CA', {
			timeZone: timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}).format(at);
	} catch {
		return new Intl.DateTimeFormat('en-CA', {
			timeZone: 'UTC',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}).format(at);
	}
}

export function isToday(date: string, timezone: string): boolean {
	return date === localDate(timezone);
}

/** 'Tuesday, August 12' — for timeline headers. Parses at UTC noon to avoid drift. */
export function formatDay(date: string): string {
	const parsed = new Date(`${date}T12:00:00Z`);
	return new Intl.DateTimeFormat('en-US', {
		timeZone: 'UTC',
		weekday: 'long',
		month: 'long',
		day: 'numeric',
	}).format(parsed);
}

/** Best-guess IANA timezone of the current environment (used as space default). */
export function systemTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
	} catch {
		return 'UTC';
	}
}

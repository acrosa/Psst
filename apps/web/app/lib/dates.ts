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

/** The same calendar date, n days on (negative for back). */
export function addDays(date: string, n: number): string {
	const parsed = new Date(`${date}T12:00:00Z`);
	parsed.setUTCDate(parsed.getUTCDate() + n);
	return parsed.toISOString().slice(0, 10);
}

/** The Monday that starts this date's week. */
export function weekStart(date: string): string {
	const parsed = new Date(`${date}T12:00:00Z`);
	return addDays(date, -((parsed.getUTCDay() + 6) % 7));
}

/** 'August 25 – 31', or 'August 29 – September 4' when the week straddles a month. */
export function formatWeek(start: string): string {
	const end = addDays(start, 6);
	const monthDay = new Intl.DateTimeFormat('en-US', {
		timeZone: 'UTC',
		month: 'long',
		day: 'numeric',
	});
	const from = monthDay.format(new Date(`${start}T12:00:00Z`));
	const to = new Date(`${end}T12:00:00Z`);
	const sameMonth = start.slice(0, 7) === end.slice(0, 7);
	return `${from} – ${sameMonth ? to.getUTCDate() : monthDay.format(to)}`;
}

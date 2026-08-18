import { useEffect, useState } from 'react';

/**
 * Hidden field that fills in the visitor's IANA timezone after hydration
 * (server renders UTC, so no hydration mismatch).
 */
export function TimezoneInput({ name = 'timezone' }: { name?: string }) {
	const [timezone, setTimezone] = useState('UTC');

	useEffect(() => {
		try {
			setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
		} catch {
			// keep UTC
		}
	}, []);

	return <input type="hidden" name={name} value={timezone} />;
}

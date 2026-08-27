/** Loose "did they mean a URL?" check for composer/paste/drop input. */
export function looksLikeUrl(value: string): boolean {
	if (/^https?:\/\//i.test(value)) return true;
	return !value.includes(' ') && /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(value);
}

export function normalizeUrl(value: string): string {
	return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

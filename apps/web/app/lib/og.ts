/**
 * Open Graph / Twitter card tags for the public pages — link previews are a
 * sharing surface, and sharing is the whole point. The image URL is absolute
 * (scrapers require it), pinned to the canonical prod host.
 */
const OG_IMAGE = 'https://www.psst.you/og.png';

export function ogMeta({ title, description }: { title: string; description: string }) {
	return [
		{ name: 'description', content: description },
		{ property: 'og:site_name', content: 'psst' },
		{ property: 'og:type', content: 'website' },
		{ property: 'og:title', content: title },
		{ property: 'og:description', content: description },
		{ property: 'og:image', content: OG_IMAGE },
		{ property: 'og:image:width', content: '1200' },
		{ property: 'og:image:height', content: '630' },
		{ name: 'twitter:card', content: 'summary_large_image' },
		{ name: 'twitter:title', content: title },
		{ name: 'twitter:description', content: description },
		{ name: 'twitter:image', content: OG_IMAGE },
	];
}

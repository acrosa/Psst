/**
 * Apple App Site Association — links psst.you to the iOS app so password
 * managers offer saved credentials in the native login (webcredentials),
 * and seeds universal links later. Apple's CDN fetches this unauthenticated
 * and does not follow redirects, so it must 200 on the canonical host.
 */
export async function loader() {
	return Response.json(
		{
			webcredentials: { apps: ['49MWCX22SN.you.psst.app'] },
		},
		{ headers: { 'Cache-Control': 'public, max-age=3600' } },
	);
}

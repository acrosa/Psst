/**
 * A local OpenGraph fixture page so the unfurl pipeline can be exercised
 * end-to-end without leaving localhost. Dev/test only.
 */
export async function loader({ request }: { request: Request }) {
	if (process.env.NODE_ENV === 'production') {
		throw new Response('Not found', { status: 404 });
	}

	const origin = new URL(request.url).origin;
	const html = `<!doctype html>
<html>
	<head>
		<title>A Cozy Test Page</title>
		<meta property="og:title" content="A Cozy Test Page" />
		<meta property="og:description" content="Warm blankets and tiny links." />
		<meta property="og:image" content="${origin}/favicon.svg" />
		<meta property="og:site_name" content="Cozy Fixtures" />
		<link rel="icon" href="${origin}/favicon.svg" />
	</head>
	<body>hello from the fixture</body>
</html>`;

	return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

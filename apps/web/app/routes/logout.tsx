import { redirect } from 'react-router';
import { auth } from '~/lib/auth.server';
import type { Route } from './+types/logout';

export async function loader() {
	return redirect('/');
}

export async function action({ request }: Route.ActionArgs) {
	const response = await auth.api.signOut({
		headers: request.headers,
		asResponse: true,
	});

	return new Response(null, {
		status: 302,
		headers: {
			Location: '/',
			'Set-Cookie': response.headers.get('set-cookie') ?? '',
		},
	});
}

import { Button } from '~/components/ui/button';
import { authClient } from '~/lib/auth.client';

export function GoogleButton({ next }: { next: string }) {
	// Better Auth sends the browser here after Google; /auth/continue then
	// accepts an invite `next` so OAuth users skip the extra Join click too.
	const callbackURL = `/auth/continue?next=${encodeURIComponent(next)}`;
	return (
		<Button
			variant="soft"
			className="w-full"
			onClick={() => {
				void authClient.signIn.social({ provider: 'google', callbackURL });
			}}
		>
			Continue with Google
		</Button>
	);
}

import { Button } from '~/components/ui/button';
import { authClient } from '~/lib/auth.client';

export function GoogleButton({ next }: { next: string }) {
	return (
		<Button
			variant="soft"
			className="w-full"
			onClick={() => {
				void authClient.signIn.social({ provider: 'google', callbackURL: next });
			}}
		>
			Continue with Google
		</Button>
	);
}

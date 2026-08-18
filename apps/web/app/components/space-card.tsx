import { Link } from 'react-router';
import { AvatarStack } from '~/components/ui/avatar';
import type { SpaceSummary } from '~/lib/services/spaces.server';

export function SpaceCard({ space }: { space: SpaceSummary }) {
	return (
		<Link
			to={`/spaces/${space.id}`}
			className="group flex flex-col gap-3 rounded-xl border border-line bg-card p-5 shadow-card transition hover:-rotate-1 hover:shadow-lift"
		>
			<span className="text-4xl transition group-hover:scale-110">{space.emoji}</span>
			<span className="font-medium text-lg leading-tight">{space.name}</span>
			<span className="flex items-center justify-between gap-2">
				<AvatarStack people={space.members} />
				<span className="rounded-full bg-paper-deep px-2.5 py-1 text-xs text-ink-soft">
					{space.todayCount > 0 ? `${space.todayCount} today` : 'quiet today'}
				</span>
			</span>
		</Link>
	);
}

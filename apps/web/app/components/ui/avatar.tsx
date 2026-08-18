import { cn } from '~/lib/cn';

const TONES = ['bg-blush', 'bg-sky', 'bg-meadow', 'bg-butter', 'bg-lavender'];

function tone(seed: string): string {
	let hash = 0;
	for (const char of seed) {
		hash = (hash * 31 + char.charCodeAt(0)) % 997;
	}
	return TONES[hash % TONES.length];
}

/** Initial-on-pastel avatar (image when available). */
export function Avatar({
	name,
	image,
	size = 'md',
	className,
}: {
	name: string | null;
	image?: string | null;
	size?: 'sm' | 'md';
	className?: string;
}) {
	const label = name?.trim() || '?';
	const initial = [...label][0]?.toUpperCase() ?? '?';
	const sizeClasses = size === 'sm' ? 'h-6 w-6 text-xs' : 'h-8 w-8 text-sm';

	if (image) {
		return (
			<img
				src={image}
				alt={label}
				title={label}
				className={cn('rounded-full object-cover', sizeClasses, className)}
			/>
		);
	}

	return (
		<span
			title={label}
			className={cn(
				'inline-flex items-center justify-center rounded-full font-medium text-ink',
				sizeClasses,
				tone(label),
				className,
			)}
		>
			{initial}
		</span>
	);
}

export function AvatarStack({
	people,
	className,
}: {
	people: Array<{ id: string; name: string | null; image?: string | null }>;
	className?: string;
}) {
	return (
		<span className={cn('flex -space-x-2', className)}>
			{people.map((person) => (
				<Avatar
					key={person.id}
					name={person.name}
					image={person.image}
					size="sm"
					className="ring-2 ring-card"
				/>
			))}
		</span>
	);
}

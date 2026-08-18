import type { ComponentProps } from 'react';
import { cn } from '~/lib/cn';

export function Input({ className, ...props }: ComponentProps<'input'>) {
	return (
		<input
			className={cn(
				'h-10 w-full rounded-lg border border-line bg-card px-3 text-base text-ink',
				'placeholder:text-ink-faint',
				'focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent/40',
				'disabled:pointer-events-none disabled:opacity-50',
				className,
			)}
			{...props}
		/>
	);
}

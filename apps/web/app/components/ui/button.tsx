import type { ComponentProps } from 'react';
import { cn } from '~/lib/cn';

type ButtonProps = ComponentProps<'button'> & {
	variant?: 'primary' | 'soft' | 'ghost' | 'danger';
	size?: 'sm' | 'md';
};

const variants = {
	primary: 'bg-accent text-white shadow-card hover:bg-accent-deep',
	soft: 'bg-paper-deep text-ink hover:bg-line',
	ghost: 'text-ink-soft hover:bg-paper-deep hover:text-ink',
	danger: 'bg-transparent text-accent-deep hover:bg-accent-soft',
};

const sizes = {
	sm: 'h-8 px-3 text-sm',
	md: 'h-10 px-4 text-sm',
};

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
	return (
		<button
			type="button"
			className={cn(
				'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-medium transition',
				'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
				'disabled:pointer-events-none disabled:opacity-50',
				variants[variant],
				sizes[size],
				className,
			)}
			{...props}
		/>
	);
}

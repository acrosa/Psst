import type { ComponentProps } from 'react';
import { cn } from '~/lib/cn';

export function Label({ className, ...props }: ComponentProps<'label'>) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: htmlFor is supplied by callers
		<label className={cn('text-sm font-medium text-ink', className)} {...props} />
	);
}

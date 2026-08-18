export function FormError({ error }: { error?: string | null }) {
	if (!error) return null;
	return (
		<div className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-deep" role="alert">
			{error}
		</div>
	);
}

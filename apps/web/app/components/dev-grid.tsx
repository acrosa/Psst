import { Suspense, lazy, useEffect, useState } from 'react';

/**
 * GridKit, in development only: the grid the iOS app checks against too
 * (`design/grid/psst.json`). Toggle it from the corner pill or ⌥⇧G. Lazy and
 * dev-gated, so production bundles never carry it.
 */
const Overlay = import.meta.env.DEV ? lazy(() => import('./dev-grid-overlay')) : null;

export function DevGrid() {
	// The overlay portals into document.body — client only.
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	if (!Overlay || !mounted) return null;
	return (
		<Suspense fallback={null}>
			<Overlay />
		</Suspense>
	);
}

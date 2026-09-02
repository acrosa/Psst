/**
 * Paper cuts — seeded outlines for the board's physical materials. Pure
 * functions, shared by the board and the landing page.
 */

function seededRandom(seed: string) {
	let hash = 0;
	for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 100000;
	return () => {
		hash = (hash * 9301 + 49297) % 233280;
		return hash / 233280;
	};
}

/** A torn-paper outline: straight-ish edges with a seeded deckle. */
export function tornEdge(seed: string, width: number, height: number): string {
	const rand = seededRandom(seed);
	const jitter = () => rand() * 5 - 2.5;
	const STEP = 16;
	const points: Array<[number, number]> = [];
	for (let x = STEP; x < width; x += STEP) points.push([x + jitter(), Math.abs(jitter())]);
	points.push([width - Math.abs(jitter()), Math.abs(jitter())]);
	for (let y = STEP; y < height; y += STEP) points.push([width - Math.abs(jitter()), y + jitter()]);
	points.push([width - Math.abs(jitter()), height - Math.abs(jitter())]);
	for (let x = width - STEP; x > 0; x -= STEP)
		points.push([x + jitter(), height - Math.abs(jitter())]);
	points.push([Math.abs(jitter()), height - Math.abs(jitter())]);
	for (let y = height - STEP; y > 0; y -= STEP) points.push([Math.abs(jitter()), y + jitter()]);
	return `M ${Math.abs(jitter()).toFixed(1)} ${Math.abs(jitter()).toFixed(1)} L ${points
		.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`)
		.join(' L ')} Z`;
}

/**
 * A hand-cut sticker backing: a circle with a gently irregular edge, seeded
 * per item so no two cuts are identical.
 */
export function stickerCut(seed: string): string {
	const rand = seededRandom(seed);
	const POINTS = 22;
	const pts: Array<[number, number]> = [];
	for (let i = 0; i < POINTS; i++) {
		const angle = (i / POINTS) * Math.PI * 2;
		const radius = 45 + rand() * 3.6 - 1.8;
		pts.push([50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius]);
	}
	const mid = (a: [number, number], b: [number, number]) => [
		((a[0] + b[0]) / 2).toFixed(1),
		((a[1] + b[1]) / 2).toFixed(1),
	];
	let d = `M ${mid(pts[POINTS - 1], pts[0]).join(' ')}`;
	for (let i = 0; i < POINTS; i++) {
		const p = pts[i];
		const m = mid(p, pts[(i + 1) % POINTS]);
		d += ` Q ${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m.join(' ')}`;
	}
	return `${d} Z`;
}

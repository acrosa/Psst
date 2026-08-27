import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
	plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
	server: {
		// Honor PORT so E2E runs on a dedicated port that won't collide with a dev
		// server already on 3000. strictPort (only when PORT is explicitly set)
		// makes a collision fail fast instead of silently drifting to another port.
		port: Number(process.env.PORT) || 3000,
		strictPort: Boolean(process.env.PORT),
		// Reachable over the tailnet (iPad → this machine). Vite blocks foreign
		// Host headers by default; allow MagicDNS names.
		host: true,
		allowedHosts: ['.ts.net'],
		// Pre-transform the board's dependency graph (@xyflow/react is the heavy
		// one) so first paint of a canvas isn't a cold-compile stall.
		warmup: {
			clientFiles: ['./app/components/canvas/board.tsx', './app/root.tsx'],
		},
	},
	ssr: {
		// Native modules that must not be bundled
		external: ['better-sqlite3', 'sharp'],
	},
});

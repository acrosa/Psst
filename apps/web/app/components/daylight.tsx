import { useEffect, useRef } from 'react';

/**
 * Daylight — a sunlit wall behind the landing page.
 *
 * One WebGL fragment shader paints the paper with a warm window of light and
 * the shadows of a few leaves swaying in front of it. The trick (borrowed
 * from basement.studio's "Creating Daylight" notes) is that a real shadow
 * blurs with the distance between the object and the surface: every
 * occluder carries a distance from the wall, and its penumbra radius grows
 * with it. The window frame sits far from the wall (soft), the nearest
 * leaves almost touch it (crisp).
 *
 * The sun follows the visitor's clock — low and amber at the edges of the
 * day, high and pale at noon — and the wall reads "after sundown" in dark
 * mode. Reduced motion paints a single still frame. No WebGL: the plain
 * paper shows, nothing breaks.
 */

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_paper;
uniform float u_night;   // 0 = day, 1 = after sundown
uniform vec2 u_sun;      // x: azimuth, east(-1) → west(+1); y: elevation 0..1

// --- small toolbox ---------------------------------------------------------

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

mat2 rot(float a) {
	float s = sin(a);
	float c = cos(a);
	return mat2(c, -s, s, c);
}

float sdBox(vec2 p, vec2 b, float r) {
	vec2 q = abs(p) - b + r;
	return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// A leaf: a slender ellipse that tapers toward its tip.
float sdLeaf(vec2 p, vec2 ab) {
	float k = 1.0 - 0.45 * max(p.x, 0.0) / ab.x;
	return (length(vec2(p.x, p.y / max(k, 0.25)) / ab) - 1.0) * min(ab.x, ab.y);
}

float sdSegment(vec2 p, vec2 a, vec2 b, float w) {
	vec2 pa = p - a;
	vec2 ba = b - a;
	float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
	return length(pa - ba * h) - w;
}

// Coverage of an occluder from its signed distance and penumbra radius.
float cover(float d, float r) {
	return 1.0 - smoothstep(-r, r, d);
}

// Penumbra radius for an object this far from the wall (0 = touching).
float penumbra(float distance) {
	return 0.004 + distance * 0.055;
}

// --- the scene --------------------------------------------------------------

// One sprig: a stem with leaves along it, swaying with the breeze.
float sprig(vec2 p, float t, float phase, float len) {
	float sway = sin(t * 0.43 + phase) * 0.06 + noise(vec2(t * 0.11, phase)) * 0.08 - 0.04;
	p = rot(sway) * p;
	float d = sdSegment(p, vec2(0.0), vec2(0.0, len), 0.0035);
	for (int i = 0; i < 6; i++) {
		float fi = float(i);
		float along = 0.1 + fi * (len - 0.06) / 5.0;
		float side = mod(fi, 2.0) * 2.0 - 1.0;
		float flutter = sin(t * 0.9 + phase + fi * 1.7) * 0.08;
		vec2 q = p - vec2(0.0, along);
		// Leaves lean upward off the stem, alternating sides.
		q = rot(side * (1.25 + flutter) - 1.5708) * q;
		q.x -= 0.1;
		d = min(d, sdLeaf(q, vec2(0.105, 0.022)));
	}
	return d;
}

void main() {
	vec2 frag = gl_FragCoord.xy;
	float m = min(u_res.x, u_res.y);
	float aspect = u_res.x / u_res.y;
	float portrait = step(aspect, 1.0);
	// A phone sees the wall closer up.
	vec2 p = (frag - 0.5 * u_res) / m * mix(1.0, 0.78, portrait);
	float t = u_time;

	float az = u_sun.x;
	float el = u_sun.y;

	// --- the window of light -----------------------------------------------
	// Projected onto the wall: skewed by the sun's azimuth, stretched as it
	// sinks. The frame is far from the wall, so its edges go very soft.
	vec2 wc = vec2(mix(0.27, 0.10, portrait) * aspect - 0.04 * az, 0.04 + 0.05 * (1.0 - el));
	vec2 w = p - wc;
	w.x -= w.y * az * 0.42;
	w.y /= 1.0 + (1.0 - el) * 0.5;
	w = rot(az * 0.05) * w;

	vec2 ext = vec2(0.25, 0.36);
	float frameR = penumbra(1.0);
	float glass = cover(sdBox(w, ext, 0.02), frameR);

	// Mullions: one cross, two hairline sashes.
	float mull = cover(min(abs(w.x), abs(w.y)) - 0.013, frameR * 0.7);
	float sash = cover(abs(abs(w.y) - ext.y * 0.52) - 0.005, frameR * 0.6);
	float panes = glass * (1.0 - mull * 0.9) * (1.0 - sash * 0.5);

	// --- leaves in front of the window -------------------------------------
	// Three sprigs at three distances from the wall: crisp, soft, softer.
	// They live in window space so they always fall across the light.
	float shadow = 1.0;
	{
		vec2 q = (w - vec2(-0.20, -0.44)) * 1.1;
		shadow *= 1.0 - 0.82 * cover(sprig(q, t, 0.0, 0.62), penumbra(0.08));
	}
	{
		vec2 q = rot(1.15) * (w - vec2(0.36, -0.12)) * 0.95;
		shadow *= 1.0 - 0.7 * cover(sprig(q, t, 2.1, 0.66), penumbra(0.4));
	}
	{
		vec2 q = rot(2.55) * (w - vec2(-0.30, 0.44)) * 1.15;
		shadow *= 1.0 - 0.55 * cover(sprig(q, t, 4.2, 0.5), penumbra(0.85));
	}

	// --- light -------------------------------------------------------------
	// The wall in ambient light sits a shade under the page; the sun lifts
	// the paper and warms it — amber at the horizon, pale gold at noon.
	vec3 ambient = u_paper * mix(0.962, 0.9, u_night);
	vec3 sunLow = vec3(1.06, 0.94, 0.83);
	vec3 sunHigh = vec3(1.035, 1.0, 0.95);
	vec3 sun = mix(sunLow, sunHigh, smoothstep(0.0, 0.8, el));
	vec3 moon = vec3(1.55, 1.65, 1.9);
	vec3 lit = u_paper * mix(sun, moon, u_night);

	// A breath of air moving through the beam.
	float haze = 0.94 + 0.06 * noise(p * 3.0 + vec2(t * 0.05, -t * 0.03));
	float beam = panes * haze;

	// Inside the beam a shadow is the wall again, a touch deeper.
	vec3 col = mix(ambient, lit, beam * shadow);
	col = mix(col, ambient * 0.975, beam * (1.0 - shadow) * 0.6);
	// Sunlight spills faintly past the frame.
	float spill = cover(sdBox(w, ext + 0.1, 0.12), 0.2) * (1.0 - glass);
	col = mix(col, lit, spill * mix(0.12, 0.1, u_night));

	// Film grain so the gradients never band.
	col += (hash(frag + fract(t)) - 0.5) * 0.012;

	gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

function parseColor(value: string): [number, number, number] | null {
	const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
	if (!hex) return null;
	const n = Number.parseInt(hex[1], 16);
	return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Sun position from the local clock: azimuth east→west, elevation 0..1. */
function sunNow(hourOverride: number | null): [number, number] {
	const now = new Date();
	const hour = hourOverride ?? now.getHours() + now.getMinutes() / 60;
	const day = (hour - 6) / 12; // 0 at sunrise, 1 at sunset
	const azimuth = Math.max(-1, Math.min(1, day * 2 - 1));
	const elevation = Math.sin(Math.PI * Math.max(0, Math.min(1, day)));
	// Keep a low evening sun after dark so the wall never goes flat.
	return [azimuth, Math.max(0.18, elevation)];
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
	const shader = gl.createShader(type);
	if (!shader) return null;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		if (import.meta.env.DEV) console.error(gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}

function mount(canvas: HTMLCanvasElement): (() => void) | undefined {
	const gl = canvas.getContext('webgl', {
		alpha: false,
		antialias: false,
		depth: false,
		stencil: false,
		powerPreference: 'low-power',
	});
	if (!gl) return;

	const vert = compile(gl, gl.VERTEX_SHADER, VERT);
	const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
	const program = gl.createProgram();
	if (!vert || !frag || !program) return;
	gl.attachShader(program, vert);
	gl.attachShader(program, frag);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
	// biome-ignore lint/correctness/useHookAtTopLevel: a WebGL method, not a React hook
	gl.useProgram(program);

	// One triangle covers the viewport.
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	const aPos = gl.getAttribLocation(program, 'a_pos');
	gl.enableVertexAttribArray(aPos);
	gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

	const uRes = gl.getUniformLocation(program, 'u_res');
	const uTime = gl.getUniformLocation(program, 'u_time');
	const uPaper = gl.getUniformLocation(program, 'u_paper');
	const uNight = gl.getUniformLocation(program, 'u_night');
	const uSun = gl.getUniformLocation(program, 'u_sun');

	const root = document.documentElement;
	// Dev preview: /home2?hour=17 pins the sun.
	const hourParam = new URLSearchParams(window.location.search).get('hour');
	const hourOverride =
		hourParam !== null && !Number.isNaN(Number(hourParam)) ? Number(hourParam) : null;
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const start = performance.now();
	let frame = 0;
	let disposed = false;

	function theme() {
		const paper = parseColor(getComputedStyle(root).getPropertyValue('--color-paper')) ?? [
			0.98, 0.965, 0.937,
		];
		gl?.uniform3f(uPaper, paper[0], paper[1], paper[2]);
		gl?.uniform1f(uNight, root.classList.contains('dark') ? 1 : 0);
	}

	function resize() {
		if (!gl) return;
		const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		const width = Math.round(canvas.clientWidth * dpr);
		const height = Math.round(canvas.clientHeight * dpr);
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
			gl.viewport(0, 0, width, height);
			gl.uniform2f(uRes, width, height);
		}
	}

	function draw() {
		if (!gl || disposed) return;
		resize();
		const sun = sunNow(hourOverride);
		gl.uniform2f(uSun, sun[0], sun[1]);
		// A still frame is caught mid-breeze, not at rest.
		gl.uniform1f(uTime, reduceMotion.matches ? 11.3 : (performance.now() - start) / 1000);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		canvas.dataset.lit = '';
	}

	function loop() {
		draw();
		if (!reduceMotion.matches && !document.hidden) frame = requestAnimationFrame(loop);
	}

	function wake() {
		cancelAnimationFrame(frame);
		if (!disposed) loop();
	}

	theme();
	loop();

	const observer = new ResizeObserver(() => draw());
	observer.observe(canvas);
	const themeObserver = new MutationObserver(() => {
		theme();
		draw();
	});
	themeObserver.observe(root, { attributes: true, attributeFilter: ['class'] });
	reduceMotion.addEventListener('change', wake);
	document.addEventListener('visibilitychange', wake);

	return () => {
		disposed = true;
		cancelAnimationFrame(frame);
		observer.disconnect();
		themeObserver.disconnect();
		reduceMotion.removeEventListener('change', wake);
		document.removeEventListener('visibilitychange', wake);
		gl.getExtension('WEBGL_lose_context')?.loseContext();
	};
}

export function Daylight() {
	const ref = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		const canvas = ref.current;
		if (!canvas) return;
		return mount(canvas);
	}, []);

	return (
		<canvas
			ref={ref}
			aria-hidden
			className="block h-full w-full opacity-0 transition-opacity duration-[1400ms] ease-out data-lit:opacity-100"
		/>
	);
}

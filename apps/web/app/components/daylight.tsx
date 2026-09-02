import { useEffect, useRef } from 'react';
import { cn } from '~/lib/cn';

/**
 * Daylight — morning light on a wall, laid over the whole page.
 *
 * The canvas sits on top of the landing page with `mix-blend-mode: overlay`
 * and paints a light map: 0.5 leaves the page alone, brighter lifts it,
 * darker shades it. So the bands of sun cross the wall, the card, the
 * stickers — everything on the same plane, the way a real wall reads.
 *
 * Two WebGL passes, after basement.studio's "Creating Daylight | The
 * Shadows" (2024), the way they rendered Daylight's soft shadows:
 *
 * 1. The occluder map. Whatever hangs between the sun and the wall — a few
 *    sprigs swaying in the breeze — is drawn as (distance from the wall, 1).
 *    This is what their light camera "sees".
 * 2. The shadow pass. For each pixel, a Vogel disk (golden-angle spiral,
 *    rotated by per-pixel noise) samples the map. Each occluder found casts
 *    a shadow whose radius grows with its distance from the wall, weighted
 *    by a kernel normalised per radius. Near leaves stay crisp and dark;
 *    far ones spread wide and faint. The window blinds that throw the bands
 *    are farther still, so they are drawn as a plain soft profile.
 *
 * The sun follows the visitor's clock (the bands drift and warm through the
 * day), dark mode is the wall after sundown, reduced motion paints one still
 * frame, and without WebGL the canvas stays clear and the page is simply
 * unlit. `?hour=17` pins the sun for previews.
 */

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Shared by both passes: the wall's coordinate space.
const COMMON = `
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_sun;      // x: azimuth, east(-1) → west(+1); y: elevation 0..1

const float PI = 3.14159265359;

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

// Wall space: origin at the centre, 1 unit = the short side of the screen.
vec2 wall(vec2 frag) {
	float m = min(u_res.x, u_res.y);
	float portrait = step(u_res.x / u_res.y, 1.0);
	// A phone sees the wall closer up.
	return (frag - 0.5 * u_res) / m * mix(1.0, 0.72, portrait);
}
`;

// Pass 1 — what the light camera sees: red = distance from the wall (0 =
// touching, 1 = far), green = 1 where something casts a shadow.
const OCCLUDER_FRAG = `${COMMON}
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

// One sprig: a stem with leaves along it, swaying with the breeze.
float sprig(vec2 p, float t, float phase, float len) {
	float sway = sin(t * 0.43 + phase) * 0.06 + noise(vec2(t * 0.11, phase)) * 0.08 - 0.04;
	p = rot(sway) * p;
	float d = sdSegment(p, vec2(0.0), vec2(0.0, len), 0.0045);
	for (int i = 0; i < 6; i++) {
		float fi = float(i);
		float along = 0.1 + fi * (len - 0.06) / 5.0;
		float side = mod(fi, 2.0) * 2.0 - 1.0;
		float flutter = sin(t * 0.9 + phase + fi * 1.7) * 0.08;
		vec2 q = p - vec2(0.0, along);
		// Leaves lean upward off the stem, alternating sides.
		q = rot(side * (1.25 + flutter) - 1.5708) * q;
		q.x -= 0.1;
		d = min(d, sdLeaf(q, vec2(0.11, 0.027)));
	}
	return d;
}

// Where occluders overlap, the one nearest the wall wins — its shadow is
// the crisp one, and it shows through the other's faint blur.
void occlude(inout vec2 map, float d, float distance) {
	if (d < 0.0 && distance < map.x) map = vec2(distance, 1.0);
}

void main() {
	vec2 p = wall(gl_FragCoord.xy);
	float aspect = u_res.x / u_res.y;
	float t = u_time;
	vec2 map = vec2(1.0, 0.0);

	// A plant by the window, top left; a hanging sprig, top right.
	occlude(map, sprig(rot(0.55) * (p - vec2(-0.55 * aspect, 0.02)) * 1.0, t, 0.0, 0.66), 0.35);
	occlude(map, sprig(rot(-0.35) * (p - vec2(-0.30 * aspect, 0.22)) * 1.2, t, 2.1, 0.5), 0.7);
	occlude(map, sprig(rot(2.75) * (p - vec2(0.36 * aspect, 0.62)) * 1.05, t, 4.2, 0.6), 0.5);

	gl_FragColor = vec4(map, 0.0, 1.0);
}
`;

// Pass 2 — Vogel disk shadows over the occluder map, then the light map.
const SHADOW_FRAG = `${COMMON}
uniform sampler2D u_map;
uniform float u_night;   // 0 = day, 1 = after sundown

const float GOLDEN = PI * (3.0 - sqrt(5.0));
// Two Vogel disks: a tight one resolves the crisp shadows of things near
// the wall, a wide one the faint spread of things far from it.
const int INNER_SAMPLES = 32;
const int OUTER_SAMPLES = 64;
const float INNER = 0.026;    // radii in wall units
const float OUTER = 0.075;
const float NEAR_RADIUS = 0.016; // blur radius of an object touching the wall
const float FAR_RADIUS = 0.075;  // …and of one as far as it gets

// The occluder under offset casts a shadow of the given radius: how much
// does it reach this pixel? A quadratic falloff, normalised so that an
// occluder filling its whole radius sums to one over count samples spread
// across a disk of the given reach.
float reach(vec2 offset, float radius, float count, float disk) {
	float d = length(offset) / radius;
	float w = max(0.0, 1.0 - d * d);
	float expected = count * (radius * radius) / (disk * disk) * 0.5;
	return w / expected;
}

float shadowAt(vec2 frag) {
	float m = min(u_res.x, u_res.y);
	vec2 uv = frag / u_res;
	// Rotate every pixel's disks by noise: banding becomes grain.
	mat2 spin = rot(hash(frag) * PI);

	float shadow = 0.0;
	for (int i = 1; i <= INNER_SAMPLES; i++) {
		float r = INNER * sqrt(float(i) / float(INNER_SAMPLES));
		float theta = float(i) * GOLDEN;
		vec2 offset = spin * (r * vec2(cos(theta), sin(theta)));
		vec2 found = texture2D(u_map, uv + offset * m / u_res).rg;
		if (found.g > 0.5) {
			float radius = mix(NEAR_RADIUS, FAR_RADIUS, found.r);
			if (radius <= INNER) shadow += reach(offset, radius, float(INNER_SAMPLES), INNER);
		}
	}
	for (int i = 1; i <= OUTER_SAMPLES; i++) {
		float r = OUTER * sqrt(float(i) / float(OUTER_SAMPLES));
		float theta = float(i) * GOLDEN + 1.7;
		vec2 offset = spin * (r * vec2(cos(theta), sin(theta)));
		vec2 found = texture2D(u_map, uv + offset * m / u_res).rg;
		if (found.g > 0.5) {
			float radius = mix(NEAR_RADIUS, FAR_RADIUS, found.r);
			if (radius > INNER) shadow += reach(offset, radius, float(OUTER_SAMPLES), OUTER);
		}
	}
	return clamp(shadow, 0.0, 0.85);
}

// Sun through the blinds: bands climbing to the right, edges gone soft
// because the blinds are the farthest thing from the wall.
float bands(vec2 p, float t) {
	float az = u_sun.x;
	vec2 dir = rot(-0.62 + az * 0.08) * vec2(0.0, 1.0);
	float s = dot(p, dir) + t * 0.0025 + noise(p * 1.6 + t * 0.04) * 0.008;
	float f = fract(s / 0.44);
	float b = 0.5 + 0.5 * cos(f * 2.0 * PI);
	return smoothstep(0.22, 0.82, b);
}

void main() {
	vec2 frag = gl_FragCoord.xy;
	vec2 p = wall(frag);
	float t = u_time;
	float el = u_sun.y;

	// The pool of light: brightest top left, falling off toward the corners.
	vec2 c = (p - vec2(-0.1, 0.28)) * vec2(0.55, 1.0);
	float pool = 1.0 - 0.42 * smoothstep(0.3, 1.25, length(c));
	float light = pool * (0.62 + 0.38 * bands(p, t));
	// Shadows exist only where there is light to block.
	float shadow = shadowAt(frag) * light;

	// The light map, around neutral grey. Amber at the edges of the day,
	// paler at noon; softer after sundown so the dark wall keeps its depth.
	float amp = mix(0.34, 0.24, u_night);
	float v = 0.5 + (light - 0.55) * amp - shadow * amp * 0.75;
	vec3 warm = mix(vec3(0.05, 0.0, -0.05), vec3(0.02, 0.0, -0.02), smoothstep(0.0, 0.8, el));
	vec3 col = vec3(v) + warm * (light - 0.5) * (1.0 - u_night);

	// Plaster: fine grain, then a slower mottle.
	col += (hash(frag) - 0.5) * 0.03;
	col += (noise(p * 70.0) - 0.5) * 0.014;

	gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

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

function link(gl: WebGLRenderingContext, frag: string): WebGLProgram | null {
	const vert = compile(gl, gl.VERTEX_SHADER, VERT);
	const fragShader = compile(gl, gl.FRAGMENT_SHADER, frag);
	const program = gl.createProgram();
	if (!vert || !fragShader || !program) return null;
	gl.attachShader(program, vert);
	gl.attachShader(program, fragShader);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		if (import.meta.env.DEV) console.error(gl.getProgramInfoLog(program));
		return null;
	}
	return program;
}

/** Uniform locations for one pass, so each draw can set them by name. */
function uniforms(gl: WebGLRenderingContext, program: WebGLProgram, names: string[]) {
	const out: Record<string, WebGLUniformLocation | null> = {};
	for (const name of names) out[name] = gl.getUniformLocation(program, name);
	return out;
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

	const occluderPass = link(gl, OCCLUDER_FRAG);
	const shadowPass = link(gl, SHADOW_FRAG);
	if (!occluderPass || !shadowPass) return;
	const shared = ['u_res', 'u_time', 'u_sun'];
	const occluderU = uniforms(gl, occluderPass, shared);
	const shadowU = uniforms(gl, shadowPass, [...shared, 'u_map', 'u_night']);

	// One triangle covers the viewport; both programs read the same attribute.
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	for (const program of [occluderPass, shadowPass]) {
		const aPos = gl.getAttribLocation(program, 'a_pos');
		gl.enableVertexAttribArray(aPos);
		gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
	}

	// The occluder map lives in a texture the shadow pass samples.
	const map = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, map);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	const framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, map, 0);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	const root = document.documentElement;
	// Dev preview: /home2?hour=17 pins the sun.
	const hourParam = new URLSearchParams(window.location.search).get('hour');
	const hourOverride =
		hourParam !== null && !Number.isNaN(Number(hourParam)) ? Number(hourParam) : null;
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const start = performance.now();
	let night = 0;
	let frame = 0;
	let lastDraw = 0;
	let disposed = false;

	function theme() {
		night = root.classList.contains('dark') ? 1 : 0;
	}

	function resize() {
		if (!gl) return;
		// The shadow pass samples the map ~100× per pixel and the result is
		// soft by nature, so the wall renders at 1× and never wider than 1280.
		const scale = Math.min(1, 1280 / Math.max(canvas.clientWidth, canvas.clientHeight, 1));
		const width = Math.max(1, Math.round(canvas.clientWidth * scale));
		const height = Math.max(1, Math.round(canvas.clientHeight * scale));
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
			gl.bindTexture(gl.TEXTURE_2D, map);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		}
	}

	function draw() {
		if (!gl || disposed) return;
		resize();
		const sun = sunNow(hourOverride);
		// A still frame is caught mid-breeze, not at rest.
		const time = reduceMotion.matches ? 11.3 : (performance.now() - start) / 1000;
		gl.viewport(0, 0, canvas.width, canvas.height);

		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		// biome-ignore lint/correctness/useHookAtTopLevel: a WebGL method, not a React hook
		gl.useProgram(occluderPass);
		gl.uniform2f(occluderU.u_res, canvas.width, canvas.height);
		gl.uniform1f(occluderU.u_time, time);
		gl.uniform2f(occluderU.u_sun, sun[0], sun[1]);
		gl.drawArrays(gl.TRIANGLES, 0, 3);

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		// biome-ignore lint/correctness/useHookAtTopLevel: a WebGL method, not a React hook
		gl.useProgram(shadowPass);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, map);
		gl.uniform1i(shadowU.u_map, 0);
		gl.uniform2f(shadowU.u_res, canvas.width, canvas.height);
		gl.uniform1f(shadowU.u_time, time);
		gl.uniform2f(shadowU.u_sun, sun[0], sun[1]);
		gl.uniform1f(shadowU.u_night, night);
		gl.drawArrays(gl.TRIANGLES, 0, 3);

		canvas.dataset.lit = '';
	}

	// A breeze reads fine at 30fps, and that halves the GPU's work.
	function loop(now = 0) {
		if (now - lastDraw >= 32) {
			lastDraw = now;
			draw();
		}
		if (!reduceMotion.matches && !document.hidden) frame = requestAnimationFrame(loop);
	}

	function wake() {
		cancelAnimationFrame(frame);
		if (!disposed) loop();
	}

	theme();
	draw();
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

/** Lay it over a page: `fixed inset-0 pointer-events-none mix-blend-overlay`. */
export function Daylight({ className }: { className?: string }) {
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
			className={cn(
				'block h-full w-full opacity-0 transition-opacity duration-[1400ms] ease-out data-lit:opacity-100',
				className,
			)}
		/>
	);
}

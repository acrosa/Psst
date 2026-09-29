/**
 * `pnpm tokens` — the web's design tokens, written out for the native app.
 *
 * The web is the source of truth: colors, type scale, radii, shadows and
 * motion from `app/app.css`; item sizes, board constants and emoji sets from
 * `app/lib/design.ts`. They become `DesignTokens.generated.swift`, so iOS
 * never hand-copies a number. `pnpm tokens --check` fails when the Swift file
 * is stale (it runs with `pnpm lint`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	BOARD,
	ITEM_SIZES,
	MOTION,
	PENCIL_COLORS,
	REACTION_EMOJIS,
	SCALE_MAX,
	SCALE_MIN,
	SLIP_TONES,
	STICKER_EMOJIS,
} from '../app/lib/design';
import { SHEET } from '../app/lib/hand';

const here = path.dirname(fileURLToPath(import.meta.url));
const CSS_PATH = path.join(here, '..', 'app', 'app.css');
const OUT_PATH = path.join(
	here,
	'..',
	'..',
	'ios',
	'Psst',
	'Shared',
	'DesignTokens.generated.swift',
);

// --------------------------------------------------------------------------
// Reading app.css
// --------------------------------------------------------------------------

/** `--name: value;` declarations inside the first block that `opener` starts. */
function declarations(css: string, opener: RegExp): Map<string, string> {
	const start = css.search(opener);
	if (start < 0) throw new Error(`app.css: no block matching ${opener}`);
	const open = css.indexOf('{', start);
	const close = css.indexOf('\n}', open);
	const body = css
		.slice(open + 1, close)
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\s+/g, ' ');
	const map = new Map<string, string>();
	for (const match of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
		map.set(match[1], match[2].trim());
	}
	return map;
}

function hex(value: string, name: string): string {
	const match = /^#([0-9a-f]{6})$/i.exec(value);
	if (!match) throw new Error(`app.css: --${name} is not a #rrggbb color (${value})`);
	return `0x${match[1].toUpperCase()}`;
}

function rem(value: string, name: string): number {
	const match = /^([\d.]+)rem$/.exec(value);
	if (!match) throw new Error(`app.css: --${name} is not in rem (${value})`);
	return Number.parseFloat(match[1]) * 16;
}

type ShadowLayer = { x: number; y: number; blur: number; color: string; opacity: number };

/** `0 1px 2px rgb(64 56 47 / 0.06), …` → layers. */
function shadow(value: string, name: string): ShadowLayer[] {
	return value.split(/,(?![^(]*\))/).map((layer) => {
		const match =
			/^\s*(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+([\d.]+)(?:px)?\s+rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)\s*$/.exec(
				layer,
			);
		if (!match) throw new Error(`app.css: can't read --${name} layer "${layer}"`);
		const [, x, y, blur, r, g, b, a] = match;
		const rgb = [r, g, b].map((c) => Number(c).toString(16).padStart(2, '0')).join('');
		return {
			x: Number(x),
			y: Number(y),
			blur: Number(blur),
			color: `0x${rgb.toUpperCase()}`,
			opacity: Number(a),
		};
	});
}

type Curve = { seconds: number; bezier: [number, number, number, number] | null };

/** `pop-in 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2) both` → duration + curve. */
function animation(value: string, name: string): Curve {
	const seconds = /([\d.]+)s/.exec(value);
	if (!seconds) throw new Error(`app.css: --${name} has no duration`);
	const bezier = /cubic-bezier\(([^)]+)\)/.exec(value);
	return {
		seconds: Number(seconds[1]),
		bezier: bezier ? (bezier[1].split(',').map((n) => Number(n.trim())) as Curve['bezier']) : null,
	};
}

// --------------------------------------------------------------------------
// Writing Swift
// --------------------------------------------------------------------------

const camel = (name: string) => name.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
const num = (n: number) => String(n);
const str = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

function swiftShadow(layers: ShadowLayer[]): string {
	return `[${layers
		.map(
			(l) =>
				`ShadowLayer(x: ${num(l.x)}, y: ${num(l.y)}, blur: ${num(l.blur)}, color: ${l.color}, opacity: ${num(l.opacity)})`,
		)
		.join(', ')}]`;
}

function swiftCurve(curve: Curve): string {
	const bezier = curve.bezier ? `(${curve.bezier.map(num).join(', ')})` : '(0.42, 0, 0.58, 1)'; // CSS ease-in-out
	return `Curve(seconds: ${num(curve.seconds)}, bezier: ${bezier})`;
}

export function generate(css: string): string {
	const light = declarations(css, /@theme\s*\{/);
	const dark = declarations(css, /:root\.dark\s*\{/);

	const colors = [...light.keys()]
		.filter((key) => key.startsWith('color-'))
		.map((key) => {
			const name = key.slice('color-'.length);
			const darkValue = dark.get(key);
			if (!darkValue) throw new Error(`app.css: --${key} has no dark value`);
			return `\t\tstatic let ${camel(name)} = HexPair(light: ${hex(light.get(key) ?? '', key)}, dark: ${hex(darkValue, key)})`;
		});

	const scale = (prefix: string) =>
		[...light.keys()]
			.filter((key) => key.startsWith(prefix))
			.map(
				(key) =>
					`\t\tstatic let ${camel(key.slice(prefix.length)).replace(/^(\d)(\w+)$/, '$2$1')}: CGFloat = ${num(rem(light.get(key) ?? '', key))}`,
			);

	const shadows = ['card', 'lift'].map(
		(name) =>
			`\t\tstatic let ${name} = ShadowPair(\n\t\t\tlight: ${swiftShadow(shadow(light.get(`shadow-${name}`) ?? '', `shadow-${name}`))},\n\t\t\tdark: ${swiftShadow(shadow(dark.get(`shadow-${name}`) ?? '', `shadow-${name}`))}\n\t\t)`,
	);

	const popIn = animation(light.get('animate-pop-in') ?? '', 'animate-pop-in');
	const shimmer = animation(light.get('animate-shimmer') ?? '', 'animate-shimmer');

	const sizes = Object.entries(ITEM_SIZES).map(
		([type, size]) => `\t\tstatic let ${type} = CGSize(width: ${size.w}, height: ${size.h})`,
	);

	const tones = SLIP_TONES.map((tone) => str(camel(tone.replace(/^bg-/, ''))));

	return `// Generated by \`pnpm tokens\` from apps/web/app/app.css and app/lib/design.ts.
// Do not edit — change the web source and regenerate. \`pnpm lint\` fails when stale.

import CoreGraphics

/// psst's design tokens, straight from the web (docs/DESIGN.md is the law).
enum DesignTokens {
	/// Light / "paper after sundown" pairs, 0xRRGGBB.
	enum Palette {
${colors.join('\n')}
	}

	/// The fixed type scale, in points (web rem × 16).
	enum TextSize {
${scale('text-').join('\n')}
	}

	/// Corner radii, in points. Cards use continuous corners.
	enum Radius {
${scale('radius-').join('\n')}
	}

	/// The only two shadows: resting and floating. CSS blur, not SwiftUI radius.
	enum Shadow {
${shadows.join('\n')}
	}

	/// The motion vocabulary: arrival, loading, two-sidedness.
	enum Motion {
		static let popIn = ${swiftCurve(popIn)}
		/// Pop-in starts here and settles to identity.
		static let popInFromScale: CGFloat = 0.92
		static let popInFromOffsetY: CGFloat = 8
		/// A full shimmer cycle (opacity 0.45 ↔ 0.9, ease-in-out).
		static let shimmer = ${swiftCurve(shimmer)}
		/// The card flip, CSS \`ease\`.
		static let flip = Curve(seconds: ${num(MOTION.flipMs / 1000)}, bezier: (0.25, 0.1, 0.25, 1))
		static let doubleTapSeconds: Double = ${num(MOTION.doubleTapMs / 1000)}
		static let pencilSettleSeconds: Double = ${num(MOTION.pencilSettleMs / 1000)}
		static let longPressSeconds: Double = ${num(MOTION.longPressMs / 1000)}
	}

	/// Every item type's base size, in board points (1 web px = 1 pt).
	enum ItemSize {
${sizes.join('\n')}
	}

	/// The table: zoom limits, the first view, the dot grid.
	enum Board {
		static let minZoom: CGFloat = ${num(BOARD.minZoom)}
		static let maxZoom: CGFloat = ${num(BOARD.maxZoom)}
		static let fitPadding: CGFloat = ${num(BOARD.fitPadding)}
		static let fitMaxZoom: CGFloat = ${num(BOARD.fitMaxZoom)}
		static let dotGap: CGFloat = ${num(BOARD.dotGap)}
		static let dotSize: CGFloat = ${num(BOARD.dotSize)}
		static let dragThreshold: CGFloat = ${num(BOARD.dragThreshold)}
		/// Resize bounds — cards can breathe, not take over (or vanish).
		static let scaleMin: CGFloat = ${num(SCALE_MIN)}
		static let scaleMax: CGFloat = ${num(SCALE_MAX)}
	}

	/// The Sunday letter's sheet, in mm (the hand's path space).
	static let letterSheet = CGSize(width: ${SHEET.wMm}, height: ${SHEET.hMm})

	static let reactionEmojis: [String] = [${REACTION_EMOJIS.map(str).join(', ')}]
	static let stickerEmojis: [String] = [${STICKER_EMOJIS.map(str).join(', ')}]
	/// Palette names slips are seeded from, in the web's order.
	static let slipTones: [String] = [${tones.join(', ')}]
	static let pencilColors: [UInt32] = [${PENCIL_COLORS.map((c) => hex(c, 'pencil')).join(', ')}]
}

struct HexPair: Equatable, Sendable {
	let light: UInt32
	let dark: UInt32
}

struct ShadowLayer: Equatable, Sendable {
	let x: CGFloat
	let y: CGFloat
	/// CSS blur radius — SwiftUI's shadow radius is half of it.
	let blur: CGFloat
	let color: UInt32
	let opacity: Double
}

struct ShadowPair: Equatable, Sendable {
	let light: [ShadowLayer]
	let dark: [ShadowLayer]
}

struct Curve: Equatable, Sendable {
	let seconds: Double
	/// cubic-bezier control points (x1, y1, x2, y2).
	let bezier: (Double, Double, Double, Double)

	static func == (a: Curve, b: Curve) -> Bool {
		a.seconds == b.seconds && a.bezier == b.bezier
	}
}
`;
}

const output = generate(fs.readFileSync(CSS_PATH, 'utf8'));

if (process.argv.includes('--check')) {
	const current = fs.existsSync(OUT_PATH) ? fs.readFileSync(OUT_PATH, 'utf8') : '';
	if (current !== output) {
		console.error(
			'DesignTokens.generated.swift is stale — run `pnpm tokens` and commit the result.',
		);
		process.exit(1);
	}
	console.log('design tokens: up to date');
} else {
	fs.writeFileSync(OUT_PATH, output);
	console.log(`design tokens → ${path.relative(process.cwd(), OUT_PATH)}`);
}

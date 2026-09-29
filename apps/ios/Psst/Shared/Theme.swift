import CoreText
import SwiftUI

#if canImport(UIKit)
	import UIKit
#else
	import AppKit
#endif

/// psst design tokens — generated from the web (`pnpm tokens` →
/// DesignTokens.generated.swift), light and "paper after sundown".
enum PsstColor {
	static let paper = Color(DesignTokens.Palette.paper)
	static let paperDeep = Color(DesignTokens.Palette.paperDeep)
	static let ink = Color(DesignTokens.Palette.ink)
	static let inkSoft = Color(DesignTokens.Palette.inkSoft)
	static let inkFaint = Color(DesignTokens.Palette.inkFaint)
	static let card = Color(DesignTokens.Palette.card)
	static let line = Color(DesignTokens.Palette.line)
	static let accent = Color(DesignTokens.Palette.accent)
	static let accentDeep = Color(DesignTokens.Palette.accentDeep)
	static let accentSoft = Color(DesignTokens.Palette.accentSoft)
	// Content-only paper tones (slip backs, seeded per item). Never chrome.
	static let blush = Color(DesignTokens.Palette.blush)
	static let sky = Color(DesignTokens.Palette.sky)
	static let meadow = Color(DesignTokens.Palette.meadow)
	static let butter = Color(DesignTokens.Palette.butter)
	static let lavender = Color(DesignTokens.Palette.lavender)
}

/// The three type voices (docs/DESIGN.md § Type), on the web's fixed scale.
enum PsstFont {
	private static let bundled = ["Geist-Variable", "Newsreader-Variable", "Newsreader-Italic-Variable"]

	/// Make the bundled faces available to this process. Call once at launch.
	/// Faces missing from a bundle (the Mac shell) are skipped; the system
	/// fallbacks stand in.
	static func register() {
		for name in bundled {
			guard let url = Bundle.main.url(forResource: name, withExtension: "ttf") else { continue }
			CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
		}
	}

	/// UI voice — Geist: everything interactive. Follows Dynamic Type.
	static func ui(
		_ size: CGFloat = DesignTokens.TextSize.base,
		weight: Font.Weight = .regular,
		relativeTo style: Font.TextStyle = .body,
	) -> Font {
		.custom("Geist", size: size, relativeTo: style).weight(weight)
	}

	/// Serif voice, roman — Newsreader: titles and what members wrote.
	static func serif(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font {
		.custom("Newsreader", size: size, relativeTo: style)
	}

	/// Serif voice, italic — the app whispering ("psst — drop something here").
	static func whisper(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font {
		serif(size, relativeTo: style).italic()
	}

	/// Meta voice — tiny technical labels (dates, counts), uppercased at the call site.
	static func meta(_ size: CGFloat = DesignTokens.TextSize.xs) -> Font {
		.system(size: size, design: .monospaced)
	}

	/// Note slips speak typewriter: a fixed size, because the slip is paper
	/// on the table and scales with the board, not with Dynamic Type.
	static func typewriter(_ size: CGFloat) -> Font {
		.custom("American Typewriter", fixedSize: size)
	}
}

extension View {
	/// psst's only two shadows: `DesignTokens.Shadow.card` (resting) and
	/// `.lift` (floating), each two layers, re-inked after sundown.
	func psstShadow(_ pair: ShadowPair) -> some View {
		modifier(PsstShadow(pair: pair))
	}
}

private struct PsstShadow: ViewModifier {
	let pair: ShadowPair
	@Environment(\.colorScheme) private var scheme

	func body(content: Content) -> some View {
		let layers = scheme == .dark ? pair.dark : pair.light
		return layers.reduce(AnyView(content)) { view, layer in
			AnyView(
				view.shadow(
					color: Color(hex: layer.color).opacity(layer.opacity),
					// CSS blur is twice SwiftUI's radius.
					radius: layer.blur / 2,
					x: layer.x,
					y: layer.y,
				),
			)
		}
	}
}

private func component(_ hex: UInt32, _ shift: UInt32) -> CGFloat {
	CGFloat((hex >> shift) & 0xFF) / 255
}

extension Color {
	/// A token pair, following the system theme.
	init(_ pair: HexPair) {
		self.init(light: pair.light, dark: pair.dark)
	}

	/// One fixed color (0xRRGGBB) — pencil strokes, shadow ink.
	init(hex: UInt32) {
		self.init(
			.sRGB,
			red: Double(component(hex, 16)),
			green: Double(component(hex, 8)),
			blue: Double(component(hex, 0)),
			opacity: 1,
		)
	}

	/// A dynamic color from two hex values (0xRRGGBB), following the system theme.
	init(light: UInt32, dark: UInt32) {
		#if canImport(UIKit)
			self.init(
				uiColor: UIColor { traits in
					let hex = traits.userInterfaceStyle == .dark ? dark : light
					return UIColor(
						red: component(hex, 16),
						green: component(hex, 8),
						blue: component(hex, 0),
						alpha: 1,
					)
				},
			)
		#else
			self.init(
				nsColor: NSColor(name: nil) { appearance in
					let isDark = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
					let hex = isDark ? dark : light
					return NSColor(
						red: component(hex, 16),
						green: component(hex, 8),
						blue: component(hex, 0),
						alpha: 1,
					)
				},
			)
		#endif
	}
}

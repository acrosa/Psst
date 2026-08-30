import SwiftUI

#if canImport(UIKit)
	import UIKit
#else
	import AppKit
#endif

/// psst design tokens — mirrors docs/DESIGN.md (light / "paper after sundown").
enum PsstColor {
	static let paper = Color(light: 0xFAF6EF, dark: 0x211B14)
	static let paperDeep = Color(light: 0xF1EADB, dark: 0x2D261C)
	static let ink = Color(light: 0x40382F, dark: 0xECE4D4)
	static let inkSoft = Color(light: 0x8D8375, dark: 0xA89C89)
	static let inkFaint = Color(light: 0xC9BFAE, dark: 0x6A5F4E)
	static let card = Color(light: 0xFFFDF8, dark: 0x2A231A)
	static let line = Color(light: 0xE7DFCF, dark: 0x3D3427)
	static let accent = Color(light: 0xE2725B, dark: 0xE2725B)
	static let accentDeep = Color(light: 0xC95A44, dark: 0xCF5D46)
}

private func component(_ hex: UInt32, _ shift: UInt32) -> CGFloat {
	CGFloat((hex >> shift) & 0xFF) / 255
}

extension Color {
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

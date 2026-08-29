import Security
import SwiftUI
import WidgetKit

// MARK: - Shared config (self-contained: extensions can't use app-only APIs)

private enum WidgetConfig {
	static let appGroup = "group.you.psst.app"

	static var baseURL: URL {
		if let stored = UserDefaults(suiteName: appGroup)?.string(forKey: "baseURL"),
			let url = URL(string: stored)
		{
			return url
		}
		#if DEBUG
			return URL(string: "https://alejandros-macbook-pro.tailaab042.ts.net")!
		#else
			return URL(string: "https://www.psst.you")!
		#endif
	}

	/// The bearer token the app stored in the shared keychain group.
	static var bearerToken: String? {
		let query: [String: Any] = [
			kSecClass as String: kSecClassGenericPassword,
			kSecAttrService as String: "app.psst.session",
			kSecAttrAccount as String: "bearer",
			kSecAttrAccessGroup as String: appGroup,
			kSecReturnData as String: true,
			kSecMatchLimit as String: kSecMatchLimitOne,
		]
		var result: AnyObject?
		guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
			let data = result as? Data
		else { return nil }
		return String(data: data, encoding: .utf8)
	}
}

// MARK: - Board payload (mirror of GET /api/board)

private struct BoardResponse: Decodable {
	let space: Space
	let items: [Item]

	struct Space: Decodable {
		let id: String
		let name: String
		let emoji: String
	}

	struct Item: Decodable {
		let id: String
		let type: String
		let text: String?
		let x: Double?
		let y: Double?
		let rotation: Double?
		let scale: Double?
		let unfurl: Unfurl?
		let assets: [Asset]

		struct Unfurl: Decodable {
			let title: String?
			let imageUrl: String?
		}

		struct Asset: Decodable {
			let kind: String
			let url: String
		}
	}
}

/// Fixed footprints per type — mirror of `app/lib/design.ts` ITEM_SIZES.
private func baseSize(type: String, drawing: DrawingMeta?) -> CGSize {
	switch type {
	case "link": return CGSize(width: 300, height: 220)
	case "note": return CGSize(width: 260, height: 200)
	case "image": return CGSize(width: 264, height: 264)
	case "emoji": return CGSize(width: 96, height: 96)
	case "audio": return CGSize(width: 300, height: 112)
	case "drawing": return CGSize(width: drawing?.w ?? 96, height: drawing?.h ?? 96)
	default: return CGSize(width: 96, height: 96)
	}
}

/// Drawing meta stored in the item's text column: strokes as `M x y L x y …`.
private struct DrawingMeta: Decodable {
	let color: String?
	let d: String
	let w: Double
	let h: Double

	static func parse(_ raw: String?) -> DrawingMeta? {
		guard let data = raw?.data(using: .utf8) else { return nil }
		return try? JSONDecoder().decode(DrawingMeta.self, from: data)
	}

	var strokes: [[CGPoint]] {
		var subpaths: [[CGPoint]] = []
		var current: [CGPoint] = []
		var pending: Double?
		for token in d.split(separator: " ") {
			if token == "M" {
				if current.count > 1 { subpaths.append(current) }
				current = []
				pending = nil
			} else if token == "L" {
				continue
			} else if let value = Double(token) {
				if let x = pending {
					current.append(CGPoint(x: x, y: value))
					pending = nil
				} else {
					pending = value
				}
			}
		}
		if current.count > 1 { subpaths.append(current) }
		return subpaths
	}
}

// MARK: - Timeline

/// One board item shrunk to widget scale, with everything pre-fetched.
struct Mini: Identifiable {
	enum Kind {
		case photo(Data?)
		case note(String, Color)
		case sticker(String)
		case audio
		case link(String?, Data?)
		case drawing([[CGPoint]], Color, CGSize)
	}

	let id: String
	let kind: Kind
	let x: Double
	let y: Double
	let w: Double
	let h: Double
	let rotation: Double
}

struct TodayEntry: TimelineEntry {
	let date: Date
	let signedIn: Bool
	let spaceName: String
	let emoji: String
	let count: Int
	let minis: [Mini]

	/// Newest-first peeks for the small/medium families.
	var peeks: [Mini] { Array(minis.reversed().prefix(4)) }

	static let placeholder = TodayEntry(
		date: .now, signedIn: true, spaceName: "our corner", emoji: "🌷", count: 3,
		minis: [
			Mini(id: "a", kind: .note("meet you at six", tone(0)), x: 40, y: 60, w: 260, h: 200, rotation: -2),
			Mini(id: "b", kind: .sticker("🐸"), x: 330, y: 210, w: 96, h: 96, rotation: 4),
		],
	)
	static let signedOut = TodayEntry(
		date: .now, signedIn: false, spaceName: "", emoji: "🤫", count: 0, minis: [],
	)
}

struct TodayProvider: TimelineProvider {
	func placeholder(in context: Context) -> TodayEntry { .placeholder }

	func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
		Task { completion(await fetchEntry()) }
	}

	func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
		Task {
			let entry = await fetchEntry()
			completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(15 * 60))))
		}
	}

	private func fetchEntry() async -> TodayEntry {
		guard let token = WidgetConfig.bearerToken else { return .signedOut }
		var request = URLRequest(url: WidgetConfig.baseURL.appending(path: "/api/board"))
		request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
		guard let (data, response) = try? await URLSession.shared.data(for: request),
			(response as? HTTPURLResponse)?.statusCode == 200,
			let board = try? JSONDecoder().decode(BoardResponse.self, from: data)
		else { return .signedOut }

		// Items arrive z-sorted; render order is array order. Cap fetches so the
		// widget stays inside its memory budget.
		var minis: [Mini] = []
		var fetchesLeft = 8
		for item in board.items.prefix(24) {
			let drawing = item.type == "drawing" ? DrawingMeta.parse(item.text) : nil
			let base = baseSize(type: item.type, drawing: drawing)
			let scale = min(1.75, max(0.6, item.scale ?? 1))
			let kind: Mini.Kind
			switch item.type {
			case "image":
				let asset =
					item.assets.first { $0.kind == "thumb" } ?? item.assets.first { $0.kind == "original" }
				kind = .photo(await prefetch(asset?.url, budget: &fetchesLeft))
			case "note":
				kind = .note(item.text ?? "", tone(seed: item.id))
			case "emoji":
				kind = .sticker(item.text ?? "✨")
			case "audio":
				kind = .audio
			case "link":
				kind = .link(item.unfurl?.title, await prefetch(item.unfurl?.imageUrl, budget: &fetchesLeft))
			case "drawing":
				kind = .drawing(
					drawing?.strokes ?? [],
					Color(hex: drawing?.color) ?? ink,
					CGSize(width: drawing?.w ?? 96, height: drawing?.h ?? 96),
				)
			default:
				continue
			}
			minis.append(
				Mini(
					id: item.id,
					kind: kind,
					x: item.x ?? 0,
					y: item.y ?? 0,
					w: base.width * scale,
					h: base.height * scale,
					rotation: item.rotation ?? 0,
				),
			)
		}

		return TodayEntry(
			date: .now,
			signedIn: true,
			spaceName: board.space.name,
			emoji: board.space.emoji,
			count: board.items.count,
			minis: minis,
		)
	}

	private func prefetch(_ url: String?, budget: inout Int) async -> Data? {
		guard budget > 0, let url = url.flatMap({ URL(string: $0) }),
			let (data, _) = try? await URLSession.shared.data(from: url)
		else { return nil }
		budget -= 1
		return data
	}
}

// MARK: - Palette

private let paper = Color(light: 0xFAF6EF, dark: 0x211B14)
private let card = Color(light: 0xFFFDF8, dark: 0x2A231A)
private let ink = Color(light: 0x40382F, dark: 0xECE4D4)
private let inkSoft = Color(light: 0x8D8375, dark: 0xA89C89)
private let inkFaint = Color(light: 0xC9BFAE, dark: 0x6A5F4E)
private let butter = Color(light: 0xF8ECC8, dark: 0x453D24)

/// Slip tones, same order + seed hash as `seededTone` in `app/lib/design.ts`.
private let slipTones: [Color] = [
	card,
	butter,
	Color(light: 0xD9E7F4, dark: 0x2B3A49),
	Color(light: 0xDCEBD9, dark: 0x2F3F2C),
	Color(light: 0xE6DFF2, dark: 0x383049),
	Color(light: 0xF6D9D5, dark: 0x4A302D),
]

private func tone(_ index: Int) -> Color { slipTones[index % slipTones.count] }

private func tone(seed: String) -> Color {
	var hash = 0
	for scalar in seed.unicodeScalars {
		hash = (hash * 31 + Int(scalar.value)) % 9973
	}
	return tone(hash)
}

extension Color {
	fileprivate init(light: UInt32, dark: UInt32) {
		self.init(
			uiColor: UIColor { traits in
				let hex = traits.userInterfaceStyle == .dark ? dark : light
				return UIColor(
					red: CGFloat((hex >> 16) & 0xFF) / 255,
					green: CGFloat((hex >> 8) & 0xFF) / 255,
					blue: CGFloat(hex & 0xFF) / 255,
					alpha: 1,
				)
			},
		)
	}

	fileprivate init?(hex: String?) {
		guard var hex, hex.hasPrefix("#") else { return nil }
		hex.removeFirst()
		guard hex.count == 6, let value = UInt32(hex, radix: 16) else { return nil }
		self.init(light: value, dark: value)
	}
}

// MARK: - Views

struct TodayWidgetView: View {
	@Environment(\.widgetFamily) private var family
	let entry: TodayEntry

	var body: some View {
		Group {
			if !entry.signedIn {
				signedOut
			} else {
				switch family {
				case .systemSmall: small
				case .systemLarge: large
				default: medium
				}
			}
		}
		.containerBackground(paper, for: .widget)
	}

	private var signedOut: some View {
		VStack(spacing: 6) {
			Text("psst")
				.font(.system(size: 22, design: .serif))
				.italic()
			Text("sign in to see today")
				.font(.caption2)
				.foregroundStyle(inkSoft)
		}
		.foregroundStyle(ink)
	}

	private var header: some View {
		HStack(spacing: 6) {
			Text(entry.emoji)
				.font(.system(size: 15))
			Text(entry.spaceName)
				.font(.system(size: 14, weight: .medium))
				.foregroundStyle(ink)
				.lineLimit(1)
			Spacer(minLength: 0)
		}
	}

	private var countLine: some View {
		Text(entry.count == 0 ? "quiet today" : entry.count == 1 ? "1 thing today" : "\(entry.count) things today")
			.font(.caption2)
			.foregroundStyle(inkSoft)
	}

	private var emptyLine: some View {
		Text("psst — drop something here")
			.font(.system(size: 16, design: .serif))
			.italic()
			.foregroundStyle(inkSoft)
	}

	private var small: some View {
		VStack(alignment: .leading, spacing: 8) {
			header
			Spacer(minLength: 0)
			if let peek = entry.peeks.first {
				PeekTile(mini: peek)
					.frame(maxWidth: .infinity, maxHeight: .infinity)
			} else {
				Text("psst — drop something here")
					.font(.system(size: 15, design: .serif))
					.italic()
					.foregroundStyle(inkSoft)
			}
			Spacer(minLength: 0)
			countLine
		}
	}

	private var medium: some View {
		VStack(alignment: .leading, spacing: 10) {
			HStack {
				header
				countLine
			}
			if entry.peeks.isEmpty {
				Spacer(minLength: 0)
				emptyLine.frame(maxWidth: .infinity)
				Spacer(minLength: 0)
			} else {
				HStack(spacing: 10) {
					ForEach(Array(entry.peeks.enumerated()), id: \.element.id) { pair in
						PeekTile(mini: pair.element)
							.frame(maxWidth: .infinity, maxHeight: .infinity)
							.rotationEffect(.degrees(pair.offset.isMultiple(of: 2) ? -1.5 : 1.5))
					}
				}
			}
		}
	}

	/// The hero: today's canvas as it actually looks, shrunk to the widget.
	private var large: some View {
		VStack(alignment: .leading, spacing: 6) {
			HStack {
				header
				countLine
			}
			if entry.minis.isEmpty {
				Spacer(minLength: 0)
				emptyLine.frame(maxWidth: .infinity)
				Spacer(minLength: 0)
			} else {
				MiniCanvas(minis: entry.minis)
					.frame(maxWidth: .infinity, maxHeight: .infinity)
			}
		}
	}
}

/// The whole board scaled to fit — items where their people left them.
private struct MiniCanvas: View {
	let minis: [Mini]

	var body: some View {
		GeometryReader { geo in
			let minX = minis.map(\.x).min() ?? 0
			let minY = minis.map(\.y).min() ?? 0
			let maxX = minis.map { $0.x + $0.w }.max() ?? 1
			let maxY = minis.map { $0.y + $0.h }.max() ?? 1
			let pad = 24.0
			let boardW = maxX - minX + pad * 2
			let boardH = maxY - minY + pad * 2
			let s = min(geo.size.width / boardW, geo.size.height / boardH, 0.42)
			let offsetX = (geo.size.width - boardW * s) / 2
			let offsetY = (geo.size.height - boardH * s) / 2

			ZStack(alignment: .topLeading) {
				ForEach(minis) { mini in
					MiniTile(mini: mini)
						.frame(width: mini.w * s, height: mini.h * s)
						.rotationEffect(.degrees(mini.rotation))
						.position(
							x: offsetX + (mini.x - minX + pad + mini.w / 2) * s,
							y: offsetY + (mini.y - minY + pad + mini.h / 2) * s,
						)
				}
			}
			.frame(maxWidth: .infinity, maxHeight: .infinity)
		}
	}
}

/// One item in its material, at miniature size.
private struct MiniTile: View {
	let mini: Mini

	var body: some View {
		switch mini.kind {
		case .photo(let data):
			Group {
				if let data, let image = UIImage(data: data) {
					Image(uiImage: image)
						.resizable()
						.aspectRatio(contentMode: .fill)
				} else {
					inkFaint.opacity(0.3)
				}
			}
			.frame(maxWidth: .infinity, maxHeight: .infinity)
			.clipShape(RoundedRectangle(cornerRadius: 2))
			.padding(3)
			.background(card, in: RoundedRectangle(cornerRadius: 3))
			.shadow(color: .black.opacity(0.14), radius: 2, y: 1)
		case .note(let text, let toneColor):
			GeometryReader { geo in
				Text(text)
					.font(.system(size: max(4, min(9, geo.size.height * 0.13)), design: .monospaced))
					.foregroundStyle(ink)
					.padding(geo.size.height * 0.08)
					.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
			}
			.background(toneColor, in: RoundedRectangle(cornerRadius: 2))
			.shadow(color: .black.opacity(0.1), radius: 2, y: 1)
		case .sticker(let emoji):
			GeometryReader { geo in
				Text(emoji)
					.font(.system(size: geo.size.height * 0.82))
					.minimumScaleFactor(0.3)
					.frame(maxWidth: .infinity, maxHeight: .infinity)
			}
		case .audio:
			HStack(spacing: 2) {
				ForEach(0..<7, id: \.self) { index in
					Capsule()
						.fill(ink)
						.frame(width: 2, height: [8, 14, 10, 18, 9, 15, 7].map { $0 * 0.7 }[index])
				}
			}
			.frame(maxWidth: .infinity, maxHeight: .infinity)
			.background(card, in: Capsule())
			.shadow(color: .black.opacity(0.1), radius: 2, y: 1)
		case .link(let title, let data):
			VStack(spacing: 0) {
				Group {
					if let data, let image = UIImage(data: data) {
						Image(uiImage: image)
							.resizable()
							.aspectRatio(contentMode: .fill)
					} else {
						butter.opacity(0.6)
							.overlay {
								Image(systemName: "arrow.up.right")
									.font(.system(size: 10, weight: .medium))
									.foregroundStyle(inkSoft)
							}
					}
				}
				.frame(maxWidth: .infinity, maxHeight: .infinity)
				.clipped()
				if let title, !title.isEmpty {
					Text(title)
						.font(.system(size: 5, weight: .medium))
						.foregroundStyle(ink)
						.lineLimit(1)
						.padding(.horizontal, 3)
						.frame(maxWidth: .infinity, minHeight: 9, alignment: .leading)
						.background(card)
				}
			}
			.clipShape(RoundedRectangle(cornerRadius: 3))
			.background(card, in: RoundedRectangle(cornerRadius: 3))
			.shadow(color: .black.opacity(0.12), radius: 2, y: 1)
		case .drawing(let strokes, let color, let size):
			GeometryReader { geo in
				let sx = geo.size.width / max(size.width, 1)
				let sy = geo.size.height / max(size.height, 1)
				Path { path in
					for stroke in strokes {
						guard let first = stroke.first else { continue }
						path.move(to: CGPoint(x: first.x * sx, y: first.y * sy))
						for point in stroke.dropFirst() {
							path.addLine(to: CGPoint(x: point.x * sx, y: point.y * sy))
						}
					}
				}
				.stroke(color, style: StrokeStyle(lineWidth: max(0.8, 3 * sx), lineCap: .round, lineJoin: .round))
			}
		}
	}
}

/// A single item shown big-ish — the small/medium families' peek.
private struct PeekTile: View {
	let mini: Mini

	var body: some View {
		switch mini.kind {
		case .photo(let data):
			if let data, let image = UIImage(data: data) {
				Image(uiImage: image)
					.resizable()
					.aspectRatio(contentMode: .fill)
					.frame(maxWidth: .infinity, maxHeight: .infinity)
					.clipShape(RoundedRectangle(cornerRadius: 6))
					.padding(4)
					.background(card, in: RoundedRectangle(cornerRadius: 9))
					.shadow(color: .black.opacity(0.12), radius: 3, y: 1)
			}
		case .note(let text, let toneColor):
			Text(text)
				.font(.system(size: 11, design: .monospaced))
				.foregroundStyle(ink)
				.lineLimit(4)
				.padding(7)
				.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
				.background(toneColor, in: RoundedRectangle(cornerRadius: 4))
				.overlay(alignment: .top) {
					Rectangle().fill(butter.opacity(0.8)).frame(width: 26, height: 7).offset(y: -3)
				}
				.shadow(color: .black.opacity(0.1), radius: 3, y: 1)
		case .sticker(let emoji):
			Text(emoji)
				.font(.system(size: 34))
				.frame(maxWidth: .infinity, maxHeight: .infinity)
				.background(card, in: Circle())
				.shadow(color: .black.opacity(0.1), radius: 3, y: 1)
		case .audio:
			HStack(spacing: 2) {
				ForEach(0..<7, id: \.self) { index in
					Capsule()
						.fill(ink)
						.frame(width: 2, height: [8, 14, 10, 18, 9, 15, 7][index])
				}
			}
			.frame(maxWidth: .infinity, maxHeight: .infinity)
			.background(card, in: RoundedRectangle(cornerRadius: 12))
			.shadow(color: .black.opacity(0.1), radius: 3, y: 1)
		case .link:
			Image(systemName: "arrow.up.right")
				.font(.system(size: 18, weight: .medium))
				.foregroundStyle(inkSoft)
				.frame(maxWidth: .infinity, maxHeight: .infinity)
				.background(card, in: RoundedRectangle(cornerRadius: 9))
				.shadow(color: .black.opacity(0.1), radius: 3, y: 1)
		case .drawing:
			Image(systemName: "scribble.variable")
				.font(.system(size: 20))
				.foregroundStyle(ink)
				.frame(maxWidth: .infinity, maxHeight: .infinity)
		}
	}
}

// MARK: - Widget

struct TodayWidget: Widget {
	var body: some WidgetConfiguration {
		StaticConfiguration(kind: "app.psst.today", provider: TodayProvider()) { entry in
			TodayWidgetView(entry: entry)
		}
		.configurationDisplayName("Today's canvas")
		.description("What the people you whisper to added today.")
		.supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
	}
}

@main
struct PsstWidgetBundle: WidgetBundle {
	var body: some Widget {
		TodayWidget()
	}
}

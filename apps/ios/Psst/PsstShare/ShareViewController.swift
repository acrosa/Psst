import Security
import SwiftUI
import UIKit
import UniformTypeIdentifiers

// MARK: - Shared config (self-contained: extensions can't use app-only APIs)

private enum ShareConfig {
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

	static var lastSpaceId: String? {
		UserDefaults(suiteName: appGroup)?.string(forKey: "lastSpaceId")
	}

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

// MARK: - What's being dropped

private enum Payload {
	case link(URL)
	case text(String)
	case images([Data])
}

private enum SheetState {
	case loading
	case ready(Payload)
	case posting
	case done
	case failed(String)
}

// MARK: - Principal

final class ShareViewController: UIViewController {
	override func viewWillAppear(_ animated: Bool) {
		super.viewWillAppear(animated)
		// When the host presents us as a real sheet, ask for half of one.
		if let sheet = sheetPresentationController {
			sheet.detents = [.medium()]
			sheet.prefersGrabberVisible = true
			sheet.preferredCornerRadius = 24
		}
	}

	override func viewDidAppear(_ animated: Bool) {
		super.viewDidAppear(animated)
		// The system wraps extension UI in opaque container views — clear the
		// chain so the app behind stays visible and the card reads as a tent.
		var ancestor = view.superview
		while let current = ancestor {
			current.backgroundColor = .clear
			ancestor = current.superview
		}
	}

	override func viewDidLoad() {
		super.viewDidLoad()
		let root = ShareSheetView(
			context: extensionContext,
			finish: { [weak self] in
				self?.extensionContext?.completeRequest(returningItems: nil)
			},
			cancel: { [weak self] in
				self?.extensionContext?.cancelRequest(
					withError: NSError(domain: "app.psst.share", code: 0),
				)
			},
		)
		let hosting = UIHostingController(rootView: root)
		addChild(hosting)
		hosting.view.frame = view.bounds
		hosting.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
		// A drop is a small gesture — a card, not a full screen.
		view.backgroundColor = .clear
		hosting.view.backgroundColor = .clear
		view.addSubview(hosting.view)
		hosting.didMove(toParent: self)
	}
}

// MARK: - The sheet

private struct ShareSheetView: View {
	let context: NSExtensionContext?
	let finish: () -> Void
	let cancel: () -> Void

	@State private var state: SheetState = .loading
	@State private var spaceLabel: String?

	private let paper = Color(red: 0xFA / 255, green: 0xF6 / 255, blue: 0xEF / 255)
	private let ink = Color(red: 0x40 / 255, green: 0x38 / 255, blue: 0x2F / 255)
	private let inkSoft = Color(red: 0x8D / 255, green: 0x83 / 255, blue: 0x75 / 255)
	private let accent = Color(red: 0xE2 / 255, green: 0x72 / 255, blue: 0x5B / 255)

	var body: some View {
		ZStack(alignment: .bottom) {
			Color.black.opacity(0.001)
				.ignoresSafeArea()
				.onTapGesture(perform: cancel)
			card
		}
	}

	private var card: some View {
		VStack(spacing: 18) {
			HStack {
				Button("Cancel", action: cancel)
					.foregroundStyle(inkSoft)
				Spacer()
				Text("psst")
					.font(.system(size: 22, design: .serif))
					.italic()
				Spacer()
				// Balance the bar so the wordmark stays centered.
				Text("Cancel").hidden()
			}

			switch state {
			case .loading:
				ProgressView()
					.frame(height: 120)
			case .ready(let payload):
				preview(for: payload)
					.frame(maxWidth: .infinity, minHeight: 120)
				Button {
					post(payload)
				} label: {
					Text(spaceLabel.map { "Drop onto \($0)" } ?? "Drop it on the board")
						.font(.system(size: 17, weight: .semibold))
						.frame(maxWidth: .infinity)
						.frame(height: 50)
						.background(accent, in: Capsule())
						.foregroundStyle(.white)
				}
			case .posting:
				ProgressView("Dropping…")
					.frame(height: 120)
			case .done:
				VStack(spacing: 8) {
					Text("🕊️").font(.system(size: 44))
					Text("on the board")
						.font(.system(size: 20, design: .serif))
						.italic()
						.foregroundStyle(inkSoft)
				}
				.frame(height: 120)
			case .failed(let message):
				VStack(spacing: 10) {
					Text(message)
						.font(.subheadline)
						.foregroundStyle(inkSoft)
						.multilineTextAlignment(.center)
					Button("Close", action: cancel)
						.foregroundStyle(accent)
				}
				.frame(height: 120)
			}
		}
		.padding(20)
		.padding(.bottom, 6)
		.background(paper, in: RoundedRectangle(cornerRadius: 24))
		.shadow(color: .black.opacity(0.25), radius: 24, y: 8)
		.padding(.horizontal, 10)
		.padding(.bottom, 10)
		.foregroundStyle(ink)
		.task {
			await load()
		}
	}

	@ViewBuilder
	private func preview(for payload: Payload) -> some View {
		switch payload {
		case .link(let url):
			VStack(spacing: 6) {
				Text("🔗").font(.system(size: 36))
				Text(url.host() ?? url.absoluteString)
					.font(.system(size: 15, weight: .medium))
				Text(url.absoluteString)
					.font(.system(size: 12, design: .monospaced))
					.foregroundStyle(inkSoft)
					.lineLimit(2)
					.multilineTextAlignment(.center)
			}
		case .text(let text):
			Text(text)
				.font(.system(size: 15, design: .monospaced))
				.lineLimit(6)
				.padding(14)
				.frame(maxWidth: .infinity)
				.background(.white.opacity(0.6), in: RoundedRectangle(cornerRadius: 8))
		case .images(let images):
			HStack(spacing: 10) {
				ForEach(Array(images.prefix(4).enumerated()), id: \.offset) { pair in
					if let image = UIImage(data: pair.element) {
						Image(uiImage: image)
							.resizable()
							.aspectRatio(contentMode: .fill)
							.frame(width: 72, height: 72)
							.clipShape(RoundedRectangle(cornerRadius: 8))
							.shadow(color: .black.opacity(0.15), radius: 3, y: 1)
					}
				}
			}
		}
	}

	// MARK: Load what's shared

	private func load() async {
		guard ShareConfig.bearerToken != nil else {
			state = .failed("Sign in to psst first, then share again.")
			return
		}
		Task { spaceLabel = await fetchSpaceLabel() }

		let attachments = (context?.inputItems as? [NSExtensionItem])?
			.flatMap { $0.attachments ?? [] } ?? []

		if let urlProvider = attachments.first(where: {
			$0.hasItemConformingToTypeIdentifier(UTType.url.identifier)
		}) {
			if let url = try? await urlProvider.loadURL() {
				state = .ready(.link(url))
				return
			}
		}

		let imageProviders = attachments.filter {
			$0.hasItemConformingToTypeIdentifier(UTType.image.identifier)
		}
		if !imageProviders.isEmpty {
			var images: [Data] = []
			for provider in imageProviders.prefix(4) {
				if let data = try? await provider.loadImageData() {
					images.append(data)
				}
			}
			if !images.isEmpty {
				state = .ready(.images(images))
				return
			}
		}

		if let textProvider = attachments.first(where: {
			$0.hasItemConformingToTypeIdentifier(UTType.plainText.identifier)
		}) {
			if let text = try? await textProvider.loadText(), !text.isEmpty {
				// Shared text that is secretly a URL becomes a postcard.
				if let url = URL(string: text), url.scheme?.hasPrefix("http") == true {
					state = .ready(.link(url))
				} else {
					state = .ready(.text(String(text.prefix(1000))))
				}
				return
			}
		}

		state = .failed("Nothing here psst knows how to keep.")
	}

	// MARK: Post to the board

	private func post(_ payload: Payload) {
		state = .posting
		Task {
			do {
				let spaceId = try await resolveSpaceId()
				switch payload {
				case .link(let url):
					try await postForm(spaceId: spaceId, fields: ["kind": "link", "content": url.absoluteString])
				case .text(let text):
					try await postForm(spaceId: spaceId, fields: ["kind": "note", "content": text])
				case .images(let images):
					for data in images {
						try await postImage(spaceId: spaceId, data: data)
					}
				}
				state = .done
				try? await Task.sleep(for: .seconds(0.9))
				finish()
			} catch {
				state = .failed("That didn't land — try again from the app?")
			}
		}
	}

	private func fetchSpaceLabel() async -> String? {
		guard let board = try? await fetchBoard() else { return nil }
		return "\(board.space.emoji) \(board.space.name)"
	}

	private struct BoardInfo: Decodable {
		let space: Space
		struct Space: Decodable {
			let id: String
			let name: String
			let emoji: String
		}
	}

	private func fetchBoard() async throws -> BoardInfo {
		var request = URLRequest(url: ShareConfig.baseURL.appending(path: "/api/board"))
		request.httpShouldHandleCookies = false
		request.setValue("Bearer \(ShareConfig.bearerToken ?? "")", forHTTPHeaderField: "Authorization")
		let (data, _) = try await URLSession.shared.data(for: request)
		return try JSONDecoder().decode(BoardInfo.self, from: data)
	}

	private func resolveSpaceId() async throws -> String {
		if let last = ShareConfig.lastSpaceId { return last }
		return try await fetchBoard().space.id
	}

	private func authorizedPost(spaceId: String) -> URLRequest {
		var request = URLRequest(url: ShareConfig.baseURL.appending(path: "/spaces/\(spaceId)"))
		request.httpMethod = "POST"
		request.httpShouldHandleCookies = false
		request.setValue("Bearer \(ShareConfig.bearerToken ?? "")", forHTTPHeaderField: "Authorization")
		return request
	}

	private func postForm(spaceId: String, fields: [String: String]) async throws {
		var request = authorizedPost(spaceId: spaceId)
		request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
		var form = URLComponents()
		form.queryItems = ([("intent", "create-item")] + fields.map { ($0.key, $0.value) })
			.map { URLQueryItem(name: $0.0, value: $0.1) }
		request.httpBody = form.percentEncodedQuery?.data(using: .utf8)
		try await send(request)
	}

	private func postImage(spaceId: String, data: Data) async throws {
		var request = authorizedPost(spaceId: spaceId)
		let boundary = "psst-\(UUID().uuidString)"
		request.setValue(
			"multipart/form-data; boundary=\(boundary)",
			forHTTPHeaderField: "Content-Type",
		)
		var body = Data()
		func field(_ name: String, _ value: String) {
			body.append(Data("--\(boundary)\r\n".utf8))
			body.append(Data("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n".utf8))
		}
		field("intent", "create-image")
		body.append(Data("--\(boundary)\r\n".utf8))
		body.append(
			Data(
				"Content-Disposition: form-data; name=\"file\"; filename=\"shared.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n"
					.utf8,
			),
		)
		body.append(data)
		body.append(Data("\r\n--\(boundary)--\r\n".utf8))
		request.httpBody = body
		try await send(request)
	}

	private func send(_ request: URLRequest) async throws {
		let (_, response) = try await URLSession.shared.data(for: request)
		guard let http = response as? HTTPURLResponse, (200..<400).contains(http.statusCode) else {
			throw URLError(.badServerResponse)
		}
	}
}

// MARK: - NSItemProvider async sugar

extension NSItemProvider {
	fileprivate func loadURL() async throws -> URL? {
		try await withCheckedThrowingContinuation { continuation in
			loadItem(forTypeIdentifier: UTType.url.identifier) { item, error in
				if let error {
					continuation.resume(throwing: error)
				} else {
					continuation.resume(returning: item as? URL)
				}
			}
		}
	}

	fileprivate func loadText() async throws -> String? {
		try await withCheckedThrowingContinuation { continuation in
			loadItem(forTypeIdentifier: UTType.plainText.identifier) { item, error in
				if let error {
					continuation.resume(throwing: error)
				} else {
					continuation.resume(returning: item as? String)
				}
			}
		}
	}

	/// Images arrive as UIImage, file URL, or raw data depending on the app —
	/// normalize to JPEG data.
	fileprivate func loadImageData() async throws -> Data? {
		try await withCheckedThrowingContinuation { continuation in
			loadItem(forTypeIdentifier: UTType.image.identifier) { item, error in
				if let error {
					continuation.resume(throwing: error)
					return
				}
				if let url = item as? URL, let data = try? Data(contentsOf: url) {
					let jpeg = UIImage(data: data)?.jpegData(compressionQuality: 0.9)
					continuation.resume(returning: jpeg ?? data)
				} else if let image = item as? UIImage {
					continuation.resume(returning: image.jpegData(compressionQuality: 0.9))
				} else if let data = item as? Data {
					let jpeg = UIImage(data: data)?.jpegData(compressionQuality: 0.9)
					continuation.resume(returning: jpeg ?? data)
				} else {
					continuation.resume(returning: nil)
				}
			}
		}
	}
}

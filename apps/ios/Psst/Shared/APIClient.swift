import Foundation

/// The native board's client for `/api/v1` (docs/NATIVE_IOS.md §4): bearer
/// only, never cookies; the server's friendly `{ error }` copy surfaces
/// verbatim, 5xx internals never do.
struct APIClient: Sendable {
	var baseURL: URL { Config.baseURL }

	/// What a poll found: a fresh board, or nothing new since `etag`.
	enum BoardFetch: Sendable {
		case fresh(BoardPayload, etag: String?)
		case unchanged
	}

	enum Position: Sendable {
		/// Let the server place it in the loose collage.
		case auto
		/// Pinned where it was dropped, in board points.
		case at(x: Double, y: Double)
	}

	// MARK: You and your spaces

	func me() async throws -> Me {
		try await decode(Me.self, from: request("/api/v1/me"))
	}

	func spaces() async throws -> [SpaceSummary] {
		struct Spaces: Decodable { let spaces: [SpaceSummary] }
		return try await decode(Spaces.self, from: request("/api/v1/spaces")).spaces
	}

	/// The first canvas, or one more corner.
	func createSpace(name: String, emoji: String, timezone: String) async throws -> SpaceInfo {
		struct Created: Decodable { let space: SpaceInfo }
		let body: [String: Any] = ["name": name, "emoji": emoji, "timezone": timezone]
		return try await decode(Created.self, from: request("/api/v1/spaces", method: "POST", json: body))
			.space
	}

	func settings(spaceId: String) async throws -> SpaceSettings {
		try await decode(SpaceSettings.self, from: request("/api/v1/spaces/\(spaceId)"))
	}

	/// Owners only: a new name and/or mood emoji.
	func renameSpace(spaceId: String, name: String?, emoji: String?) async throws {
		var body: [String: Any] = [:]
		if let name { body["name"] = name }
		if let emoji { body["emoji"] = emoji }
		try await send(request("/api/v1/spaces/\(spaceId)", method: "PATCH", json: body))
	}

	func leaveSpace(spaceId: String) async throws {
		try await send(request("/api/v1/spaces/\(spaceId)/members/me", method: "DELETE"))
	}

	// MARK: The board

	/// Today's board. Pass the last ETag and an unchanged board costs a 304.
	func board(spaceId: String, etag: String? = nil) async throws -> BoardFetch {
		var req = try request("/api/v1/spaces/\(spaceId)/board")
		if let etag { req.setValue(etag, forHTTPHeaderField: "If-None-Match") }
		// ETags are ours to keep; URLCache must not answer for the server.
		req.cachePolicy = .reloadIgnoringLocalCacheData
		let (data, http) = try await perform(req)
		if http.statusCode == 304 { return .unchanged }
		let payload = try JSONDecoder().decode(BoardPayload.self, from: data)
		return .fresh(payload, etag: http.value(forHTTPHeaderField: "ETag"))
	}

	/// A finished day, frozen as it was left.
	func day(spaceId: String, date: String) async throws -> BoardPayload {
		try await decode(BoardPayload.self, from: request("/api/v1/spaces/\(spaceId)/days/\(date)"))
	}

	/// The scrapbook, newest first; page with the previous `nextBefore`.
	func days(spaceId: String, before: String? = nil) async throws -> DaysPayload {
		var path = "/api/v1/spaces/\(spaceId)/days"
		if let before { path += "?before=\(before)" }
		return try await decode(DaysPayload.self, from: request(path))
	}

	// MARK: Dropping things

	enum TextKind: String, Sendable {
		case link, note, emoji, drawing
	}

	/// A link, a note, a sticker or a drawing (`content` is the drawing's JSON).
	@discardableResult
	func createItem(
		spaceId: String,
		kind: TextKind,
		content: String,
		at position: Position = .auto,
	) async throws -> String {
		var body: [String: Any] = ["kind": kind.rawValue, "content": content]
		if case .at(let x, let y) = position {
			body["x"] = x
			body["y"] = y
		}
		return try await decode(
			Created.self,
			from: request("/api/v1/spaces/\(spaceId)/items", method: "POST", json: body),
		).item.id
	}

	enum FileKind: String, Sendable {
		case image, audio
	}

	/// A photo, or a voice note with its `{ duration, peaks }` meta as `content`.
	@discardableResult
	func uploadItem(
		spaceId: String,
		kind: FileKind,
		data: Data,
		mimeType: String,
		filename: String,
		content: String? = nil,
		at position: Position = .auto,
	) async throws -> String {
		var fields = ["kind": kind.rawValue]
		if let content { fields["content"] = content }
		if case .at(let x, let y) = position {
			fields["x"] = String(x)
			fields["y"] = String(y)
		}
		var req = try request("/api/v1/spaces/\(spaceId)/items", method: "POST")
		let boundary = "psst-\(UUID().uuidString)"
		req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
		req.httpBody = Self.multipart(
			boundary: boundary,
			fields: fields,
			file: (name: "file", filename: filename, mimeType: mimeType, data: data),
		)
		return try await decode(Created.self, from: req).item.id
	}

	// MARK: Arranging, reacting, writing on the back

	/// Anyone may move anything — arranging together is the point.
	func move(itemId: String, x: Double, y: Double) async throws {
		try await send(request("/api/v1/items/\(itemId)", method: "PATCH", json: ["x": x, "y": y]))
	}

	/// Let a card breathe (the server clamps to 0.6–1.75).
	func resize(itemId: String, scale: Double) async throws {
		try await send(request("/api/v1/items/\(itemId)", method: "PATCH", json: ["scale": scale]))
	}

	/// Take your own thing back off the board (the owner may take the letter down).
	func delete(itemId: String) async throws {
		try await send(request("/api/v1/items/\(itemId)", method: "DELETE"))
	}

	/// Toggle a reaction; answers whether it's now on.
	@discardableResult
	func react(itemId: String, emoji: String) async throws -> Bool {
		struct Toggled: Decodable { let reacted: Bool }
		return try await decode(
			Toggled.self,
			from: request("/api/v1/items/\(itemId)/reactions", method: "POST", json: ["emoji": emoji]),
		).reacted
	}

	/// Write on the back — 280 characters, a caption, not a thread.
	func comment(itemId: String, text: String) async throws {
		try await send(
			request("/api/v1/items/\(itemId)/comments", method: "POST", json: ["text": text]),
		)
	}

	// MARK: Sharing and invites

	/// Show today around: the public, read-only link.
	func shareToday(spaceId: String) async throws -> URL {
		struct Minted: Decodable { let url: URL }
		return try await decode(
			Minted.self,
			from: request("/api/v1/spaces/\(spaceId)/share", method: "POST"),
		).url
	}

	func unshareToday(spaceId: String) async throws {
		try await send(request("/api/v1/spaces/\(spaceId)/share", method: "DELETE"))
	}

	/// One more seat: a link to pass along, or emailed when `email` is given.
	func invite(spaceId: String, email: String? = nil) async throws -> URL {
		struct Invite: Decodable { let url: URL }
		let body: [String: Any] = email.map { ["email": $0] } ?? [:]
		return try await decode(
			Invite.self,
			from: request("/api/v1/spaces/\(spaceId)/invites", method: "POST", json: body),
		).url
	}

	func revokeInvite(spaceId: String, inviteId: String) async throws {
		try await send(request("/api/v1/spaces/\(spaceId)/invites/\(inviteId)", method: "DELETE"))
	}

	/// Walk through an invite (a universal link). Sad outcomes come back as a
	/// status with warm copy, not a thrown error.
	func acceptInvite(token: String) async throws -> InviteAcceptance {
		let (data, http) = try await perform(request("/api/v1/invites/\(token)/accept", method: "POST"))
		if http.statusCode == 401 { throw APIError.noSession }
		if http.statusCode >= 500 { throw APIError.badResponse(http.statusCode, Self.hiccup) }
		return try JSONDecoder().decode(InviteAcceptance.self, from: data)
	}

	// MARK: Plumbing

	private struct Created: Decodable {
		struct Item: Decodable { let id: String }
		let item: Item
	}

	private static let hiccup = "Something hiccuped on our end — try again in a moment."

	private func request(_ path: String, method: String = "GET", json: [String: Any]? = nil) throws
		-> URLRequest
	{
		guard let token = SessionStore.bearerToken else { throw APIError.noSession }
		guard let url = URL(string: path, relativeTo: baseURL) else {
			throw APIError.badResponse(0, nil)
		}
		var req = URLRequest(url: url)
		req.httpMethod = method
		// Bearer only: a stale cookie would trip better-auth's CSRF checks.
		req.httpShouldHandleCookies = false
		req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
		req.setValue("application/json", forHTTPHeaderField: "Accept")
		if let json {
			req.setValue("application/json", forHTTPHeaderField: "Content-Type")
			req.httpBody = try JSONSerialization.data(withJSONObject: json)
		}
		return req
	}

	private func perform(_ req: URLRequest) async throws -> (Data, HTTPURLResponse) {
		let (data, response) = try await URLSession.shared.data(for: req)
		guard let http = response as? HTTPURLResponse else { throw APIError.badResponse(0, nil) }
		return (data, http)
	}

	/// Perform, then turn anything but 2xx/304 into an APIError with the
	/// server's own words (4xx) or a hiccup (5xx).
	private func checked(_ req: URLRequest) async throws -> Data {
		let (data, http) = try await perform(req)
		switch http.statusCode {
		case 200..<300, 304:
			return data
		case 401:
			throw APIError.noSession
		case 500...:
			throw APIError.badResponse(http.statusCode, Self.hiccup)
		default:
			let message =
				(try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
			throw APIError.badResponse(http.statusCode, message)
		}
	}

	private func decode<T: Decodable>(_ type: T.Type, from req: URLRequest) async throws -> T {
		let data = try await checked(req)
		return try JSONDecoder().decode(type, from: data)
	}

	private func send(_ req: URLRequest) async throws {
		_ = try await checked(req)
	}

	private static func multipart(
		boundary: String,
		fields: [String: String],
		file: (name: String, filename: String, mimeType: String, data: Data),
	) -> Data {
		var body = Data()
		for (name, value) in fields.sorted(by: { $0.key < $1.key }) {
			body.append(Data("--\(boundary)\r\n".utf8))
			body.append(Data("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n".utf8))
		}
		body.append(Data("--\(boundary)\r\n".utf8))
		body.append(
			Data(
				"Content-Disposition: form-data; name=\"\(file.name)\"; filename=\"\(file.filename)\"\r\n"
					.utf8,
			),
		)
		body.append(Data("Content-Type: \(file.mimeType)\r\n\r\n".utf8))
		body.append(file.data)
		body.append(Data("\r\n--\(boundary)--\r\n".utf8))
		return body
	}
}

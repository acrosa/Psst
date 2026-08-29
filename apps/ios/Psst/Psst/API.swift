import Foundation

/// The board payload served by GET /api/board (shared with the widget).
struct BoardResponse: Decodable {
	let space: BoardSpace
	let date: String
	let items: [BoardItem]
}

struct BoardSpace: Decodable {
	let id: String
	let name: String
	let emoji: String
}

struct BoardItem: Decodable {
	let id: String
	let type: String
	let text: String?
	let url: String?
	let authorName: String?
	let assets: [BoardAsset]
}

struct BoardAsset: Decodable {
	let kind: String
	let url: String
}

enum APIError: LocalizedError {
	case badResponse(Int, String?)
	case noSession

	var errorDescription: String? {
		switch self {
		case .badResponse(_, let message):
			return message ?? "That didn’t work — try again?"
		case .noSession:
			return "Sign in first."
		}
	}
}

/// Thin client for the psst JSON surface. Sign-in captures both the bearer
/// token (native requests) and the session cookie (for the web canvas).
struct PsstAPI {
	var baseURL: URL { Config.baseURL }

	struct Session {
		let bearer: String?
		let cookieName: String?
		let cookieValue: String?
	}

	// MARK: Auth

	func signIn(email: String, password: String) async throws -> Session {
		try await authenticate(
			path: "/api/auth/sign-in/email",
			body: ["email": email, "password": password],
		)
	}

	func signUp(name: String, email: String, password: String) async throws -> Session {
		try await authenticate(
			path: "/api/auth/sign-up/email",
			body: ["name": name, "email": email, "password": password],
		)
	}

	func signInWithApple(idToken: String) async throws -> Session {
		try await authenticate(
			path: "/api/auth/sign-in/social",
			body: ["provider": "apple", "idToken": ["token": idToken]],
		)
	}

	private func authenticate(path: String, body: [String: Any]) async throws -> Session {
		var request = URLRequest(url: baseURL.appending(path: path))
		request.httpMethod = "POST"
		request.setValue("application/json", forHTTPHeaderField: "Content-Type")
		// better-auth requires a trusted Origin on cookie-carrying POSTs, and
		// URLSession attaches stored cookies but never sends Origin on its own.
		if let scheme = baseURL.scheme, let host = baseURL.host() {
			request.setValue("\(scheme)://\(host)", forHTTPHeaderField: "Origin")
		}
		request.httpBody = try JSONSerialization.data(withJSONObject: body)

		let (data, response) = try await URLSession.shared.data(for: request)
		guard let http = response as? HTTPURLResponse else { throw APIError.badResponse(0, nil) }
		guard (200..<300).contains(http.statusCode) else {
			let message =
				(try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["message"] as? String
			throw APIError.badResponse(http.statusCode, message)
		}

		let bearer = http.value(forHTTPHeaderField: "set-auth-token")
		let headers = (http.allHeaderFields as? [String: String]) ?? [:]
		let cookies = HTTPCookie.cookies(withResponseHeaderFields: headers, for: baseURL)
		let session = cookies.first { $0.name.contains("session_token") }
		return Session(bearer: bearer, cookieName: session?.name, cookieValue: session?.value)
	}

	// MARK: Authenticated JSON

	private func authorizedRequest(path: String, method: String = "GET") throws -> URLRequest {
		guard let token = SessionStore.bearerToken else { throw APIError.noSession }
		var request = URLRequest(url: baseURL.appending(path: path))
		request.httpMethod = method
		request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
		request.setValue("application/json", forHTTPHeaderField: "Content-Type")
		return request
	}

	func fetchBoard(spaceId: String? = nil) async throws -> BoardResponse {
		var path = "/api/board"
		if let spaceId { path += "?spaceId=\(spaceId)" }
		let request = try authorizedRequest(path: path)
		let (data, response) = try await URLSession.shared.data(for: request)
		guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
			throw APIError.badResponse((response as? HTTPURLResponse)?.statusCode ?? 0, nil)
		}
		return try JSONDecoder().decode(BoardResponse.self, from: data)
	}

	func registerDevice(token: String, remove: Bool = false) async {
		guard var request = try? authorizedRequest(path: "/api/devices", method: "POST") else { return }
		var body: [String: Any] = ["token": token]
		if remove { body["remove"] = true }
		request.httpBody = try? JSONSerialization.data(withJSONObject: body)
		_ = try? await URLSession.shared.data(for: request)
	}
}

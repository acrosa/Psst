import Foundation

/// Counts what the people you whisper to added while you weren't looking:
/// items in the current space newer than the last peek, by someone else.
/// Polls quietly; errors keep the last count (a menu bar is no place for
/// error states) — except a dead session, which is reported.
final class UnreadTracker {
	var onChange: ((Int) -> Void)?
	var onSessionExpired: (() -> Void)?

	private(set) var count = 0 {
		didSet { if count != oldValue { onChange?(count) } }
	}

	private var timer: Timer?
	private var paused = false
	private let api = PsstAPI()
	private let defaults = UserDefaults.standard

	private static let lastSeenKey = "unreadLastSeenAt"
	private static let userIdKey = "meUserId"

	private let iso: ISO8601DateFormatter = {
		let formatter = ISO8601DateFormatter()
		formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
		return formatter
	}()

	private var lastSeenAt: Date {
		get {
			if let stored = defaults.object(forKey: Self.lastSeenKey) as? Date { return stored }
			// First run starts quiet — history isn't unread.
			let now = Date()
			defaults.set(now, forKey: Self.lastSeenKey)
			return now
		}
		set { defaults.set(newValue, forKey: Self.lastSeenKey) }
	}

	func start() {
		stop()
		let timer = Timer(timeInterval: 60, repeats: true) { [weak self] _ in
			Task { @MainActor in self?.poll() }
		}
		RunLoop.main.add(timer, forMode: .common)
		self.timer = timer
		poll()
	}

	func stop() {
		timer?.invalidate()
		timer = nil
		count = 0
	}

	/// The panel is open — everything on it is seen, and polling can rest.
	func pause() {
		paused = true
		markSeen()
	}

	func resume() {
		paused = false
		markSeen()
		poll()
	}

	func markSeen() {
		lastSeenAt = Date()
		count = 0
	}

	func poll() {
		guard !paused, SessionStore.bearerToken != nil else { return }
		Task { [weak self] in
			guard let self else { return }
			do {
				let board = try await api.fetchBoard(spaceId: Config.lastSpaceId)
				Config.lastSpaceId = board.space.id
				let me = try await self.currentUserId()
				let seen = self.lastSeenAt
				self.count = board.items.filter { item in
					guard let created = item.createdAt.flatMap(self.parseDate) else { return false }
					return created > seen && item.authorId != me
				}.count
			} catch is DecodingError {
				// An expired bearer never 401s here — the redirect to /login is
				// followed and HTML comes back. Confirm before signing out.
				if (try? await self.api.fetchSession()) == nil {
					self.stop()
					self.onSessionExpired?()
				}
			} catch {
				// Offline or flaky — keep the last count, stay quiet.
			}
		}
	}

	private func parseDate(_ value: String) -> Date? {
		iso.date(from: value)
	}

	private func currentUserId() async throws -> String? {
		if let cached = defaults.string(forKey: Self.userIdKey) { return cached }
		guard let session = try await api.fetchSession() else { return nil }
		defaults.set(session.user.id, forKey: Self.userIdKey)
		return session.user.id
	}

	/// A different account signed in — forget who "me" was.
	func forgetUser() {
		defaults.removeObject(forKey: Self.userIdKey)
	}
}

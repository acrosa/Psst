import Foundation

/// Where psst lives. On iOS the base URL is shared with the widget via the
/// App Group; on macOS plain defaults do (nothing to share, and the group
/// container would prompt).
enum Config {
	static let appGroup = "group.you.psst.app"

	private static var defaults: UserDefaults {
		#if os(iOS)
			UserDefaults(suiteName: appGroup) ?? .standard
		#else
			.standard
		#endif
	}

	static var baseURL: URL {
		if let stored = defaults.string(forKey: "baseURL"), let url = URL(string: stored) {
			return url
		}
		#if DEBUG
			// The dev server over the tailnet (HTTPS via `tailscale serve`).
			return URL(string: "https://alejandros-macbook-pro.tailaab042.ts.net")!
		#else
			// The canonical prod host — the apex 308-redirects here, and auth
			// POSTs must not bounce through a redirect.
			return URL(string: "https://www.psst.you")!
		#endif
	}

	static func setBaseURL(_ value: String) {
		defaults.set(value, forKey: "baseURL")
	}

	/// The space the canvas last showed — where the app reopens.
	static var lastSpaceId: String? {
		get { defaults.string(forKey: "lastSpaceId") }
		set { defaults.set(newValue, forKey: "lastSpaceId") }
	}
}

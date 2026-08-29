import Foundation

/// Where psst lives. The base URL is shared with the widget via the App Group.
enum Config {
	static let appGroup = "group.you.psst.app"

	static var baseURL: URL {
		if let stored = UserDefaults(suiteName: appGroup)?.string(forKey: "baseURL"),
			let url = URL(string: stored)
		{
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
		UserDefaults(suiteName: appGroup)?.set(value, forKey: "baseURL")
	}
}

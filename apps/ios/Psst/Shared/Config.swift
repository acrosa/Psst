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

	/// What the server last said about the native board (`auto` · `on` · `off`),
	/// cached so the kill switch holds offline and on the next cold launch.
	static var remoteNativeBoard: String? {
		get { defaults.string(forKey: "remoteNativeBoard") }
		set { defaults.set(newValue, forKey: "remoteNativeBoard") }
	}
}

/// Which board the app shows after sign-in: today's web view, or the native
/// board being built beside it (docs/NATIVE_IOS.md §2). The web view stays one
/// `case` away until the native board has earned its place.
enum BoardExperience: String {
	case web
	case native

	/// Settings app toggle ("Native board") — Settings.bundle, standard defaults.
	static let settingsKey = "psst.nativeBoard"
	/// Launch argument: `-psst.board native|web` (simulator, UI tests).
	static let argumentKey = "psst.board"

	/// Until the native board reaches parity, every build starts on the web.
	/// Flip per build here (and Settings.bundle's DefaultValue with it).
	static let buildDefault: BoardExperience = .web

	/// First match wins: the server's switch, a launch argument, the Settings
	/// toggle, then the build default.
	static var current: BoardExperience {
		switch Config.remoteNativeBoard {
		case "off": return .web
		case "on": return .native
		default: break
		}
		let arguments = UserDefaults.standard.volatileDomain(forName: UserDefaults.argumentDomain)
		if let forced = arguments[argumentKey] as? String,
			let experience = BoardExperience(rawValue: forced)
		{
			return experience
		}
		if UserDefaults.standard.object(forKey: settingsKey) != nil {
			return UserDefaults.standard.bool(forKey: settingsKey) ? .native : .web
		}
		return buildDefault
	}
}

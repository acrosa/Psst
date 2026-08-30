import SwiftUI
import WebKit

#if canImport(UIKit)
	import UIKit
#else
	import AppKit
#endif

/// The web canvas, shared by the iOS and macOS shells: a WKWebView signed in
/// with the session captured at native login. The subtle behaviors live here
/// once — cookie injection, login-bounce → native sign-out, content-process
/// recovery, last-space tracking, external links out.
enum WebCanvas {
	static func makeWebView(coordinator: WebCanvasCoordinator) -> WKWebView {
		let configuration = WKWebViewConfiguration()
		configuration.mediaTypesRequiringUserActionForPlayback = []
		#if os(iOS)
			configuration.allowsInlineMediaPlayback = true
		#endif

		let webView = WKWebView(frame: .zero, configuration: configuration)
		webView.navigationDelegate = coordinator
		webView.uiDelegate = coordinator
		coordinator.trackLastSpace(of: webView)
		webView.allowsBackForwardNavigationGestures = true
		#if os(iOS)
			webView.isOpaque = false
			webView.backgroundColor = UIColor(PsstColor.paper)
		#else
			webView.underPageBackgroundColor = NSColor(PsstColor.paper)
		#endif
		#if DEBUG
			webView.isInspectable = true
		#endif

		// Sign the webview in: the bearer token is the session cookie value.
		// The name depends on how the server sees its own scheme (an https
		// proxy in front of an http dev server uses the unprefixed name), so
		// set both and let it read the one it knows.
		let base = Config.baseURL
		let target = base.appending(
			path: Config.lastSpaceId.map { "/spaces/\($0)" } ?? "/spaces",
		)
		let secure = base.scheme == "https"
		let cookies: [HTTPCookie]
		if let value = SessionStore.bearerToken {
			var names = ["better-auth.session_token"]
			if secure { names.append("__Secure-better-auth.session_token") }
			cookies = names.compactMap { name in
				HTTPCookie(properties: [
					.name: name,
					.value: value,
					.domain: base.host() ?? "",
					.path: "/",
					.secure: secure ? "TRUE" : "FALSE",
				])
			}
		} else {
			cookies = []
		}
		let store = webView.configuration.websiteDataStore.httpCookieStore
		let group = DispatchGroup()
		for cookie in cookies {
			group.enter()
			store.setCookie(cookie) { group.leave() }
		}
		group.notify(queue: .main) {
			webView.load(URLRequest(url: target))
		}
		return webView
	}
}

final class WebCanvasCoordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
	private let onSessionExpired: () -> Void
	/// Same-host pages that outgrow this shell (a small panel can't host a
	/// full settings page) — return true to hand the URL to the browser.
	private let opensExternally: ((URL) -> Bool)?
	private var expired = false
	private var urlObservation: NSKeyValueObservation?

	init(onSessionExpired: @escaping () -> Void, opensExternally: ((URL) -> Bool)? = nil) {
		self.onSessionExpired = onSessionExpired
		self.opensExternally = opensExternally
	}

	/// Track the space on screen across SPA route changes, which never
	/// reach the navigation delegate.
	func trackLastSpace(of webView: WKWebView) {
		urlObservation = webView.observe(\.url) { view, _ in
			guard let url = view.url, url.host() == Config.baseURL.host() else { return }
			let parts = url.pathComponents
			if parts.count >= 3, parts[1] == "spaces" {
				Config.lastSpaceId = parts[2]
			}
		}
	}

	/// Keep navigation on psst; hand external links to the system.
	func webView(
		_ webView: WKWebView,
		decidePolicyFor navigationAction: WKNavigationAction,
		decisionHandler: @escaping (WKNavigationActionPolicy) -> Void,
	) {
		guard let url = navigationAction.request.url, let host = url.host() else {
			decisionHandler(.allow)
			return
		}
		if host == Config.baseURL.host() {
			// Bounced to the web login: the session died — the native
			// login is the front door, not a form inside the webview.
			if url.path() == "/login" || url.path().hasPrefix("/login") {
				decisionHandler(.cancel)
				if !expired {
					expired = true
					onSessionExpired()
				}
				return
			}
			if navigationAction.targetFrame?.isMainFrame != false, opensExternally?(url) == true {
				decisionHandler(.cancel)
				openInBrowser(url)
				return
			}
			decisionHandler(.allow)
		} else {
			decisionHandler(.cancel)
			openInBrowser(url)
		}
	}

	private func openInBrowser(_ url: URL) {
		#if os(iOS)
			UIApplication.shared.open(url)
		#else
			NSWorkspace.shared.open(url)
		#endif
	}

	/// The system reclaimed the page in the background — bring it back fresh
	/// instead of leaving a blank canvas.
	func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
		if webView.url != nil {
			webView.reload()
		} else {
			webView.load(URLRequest(url: Config.baseURL.appending(path: "/spaces")))
		}
	}

	/// The app already holds the mic permission — don't prompt twice.
	func webView(
		_ webView: WKWebView,
		requestMediaCapturePermissionFor origin: WKSecurityOrigin,
		initiatedByFrame frame: WKFrameInfo,
		type: WKMediaCaptureType,
		decisionHandler: @escaping (WKPermissionDecision) -> Void,
	) {
		let trusted = origin.host == Config.baseURL.host()
		decisionHandler(trusted ? .grant : .deny)
	}
}

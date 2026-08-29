import SwiftUI
import WebKit

/// The canvas: the existing React Flow board in a WKWebView, signed in with
/// the session captured at native login. Native owns push + widget; the web
/// mobile UI owns the board.
struct CanvasView: View {
	@Environment(AppState.self) private var appState

	var body: some View {
		CanvasWebView(
			pendingSpaceId: appState.pendingSpaceId,
			onNavigatedToPending: { appState.pendingSpaceId = nil },
			onSessionExpired: { appState.signOut() },
		)
		.ignoresSafeArea(edges: .bottom)
		.background(PsstColor.paper)
		.task {
			// Ask for the psst sound once the board is on screen.
			PushManager.shared.enable()
		}
	}
}

struct CanvasWebView: UIViewRepresentable {
	let pendingSpaceId: String?
	let onNavigatedToPending: () -> Void
	let onSessionExpired: () -> Void

	func makeCoordinator() -> Coordinator { Coordinator(onSessionExpired: onSessionExpired) }

	func makeUIView(context: Context) -> WKWebView {
		let configuration = WKWebViewConfiguration()
		configuration.allowsInlineMediaPlayback = true
		configuration.mediaTypesRequiringUserActionForPlayback = []

		let webView = WKWebView(frame: .zero, configuration: configuration)
		webView.navigationDelegate = context.coordinator
		webView.uiDelegate = context.coordinator
		webView.allowsBackForwardNavigationGestures = true
		webView.isOpaque = false
		webView.backgroundColor = UIColor(PsstColor.paper)
		#if DEBUG
			webView.isInspectable = true
		#endif

		// Sign the webview in: the bearer token is the session cookie value.
		// The name depends on how the server sees its own scheme (an https
		// proxy in front of an http dev server uses the unprefixed name), so
		// set both and let it read the one it knows.
		let base = Config.baseURL
		let target = base.appending(path: "/spaces")
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

	func updateUIView(_ webView: WKWebView, context: Context) {
		// A push was tapped: jump to that space.
		if let spaceId = pendingSpaceId {
			webView.load(URLRequest(url: Config.baseURL.appending(path: "/spaces/\(spaceId)")))
			onNavigatedToPending()
		}
	}

	final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
		private let onSessionExpired: () -> Void
		private var expired = false

		init(onSessionExpired: @escaping () -> Void) {
			self.onSessionExpired = onSessionExpired
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
				decisionHandler(.allow)
			} else {
				decisionHandler(.cancel)
				UIApplication.shared.open(url)
			}
		}

		/// iOS reclaimed the page while backgrounded — bring it back fresh
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
}

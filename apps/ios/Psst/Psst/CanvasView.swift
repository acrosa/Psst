import SwiftUI
import WebKit

/// The canvas: the existing React Flow board in a WKWebView, signed in with
/// the session captured at native login. Native owns push + widget; the web
/// mobile UI owns the board.
struct CanvasView: View {
	@Environment(AppState.self) private var appState

	var body: some View {
		CanvasWebView(pendingSpaceId: appState.pendingSpaceId) {
			appState.pendingSpaceId = nil
		}
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

	func makeCoordinator() -> Coordinator { Coordinator() }

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
		let base = Config.baseURL
		let target = base.appending(path: "/spaces")
		let secure = base.scheme == "https"
		if let value = SessionStore.bearerToken,
			let cookie = HTTPCookie(properties: [
				.name: secure ? "__Secure-better-auth.session_token" : "better-auth.session_token",
				.value: value,
				.domain: base.host() ?? "",
				.path: "/",
				.secure: secure ? "TRUE" : "FALSE",
			])
		{
			webView.configuration.websiteDataStore.httpCookieStore.setCookie(cookie) {
				webView.load(URLRequest(url: target))
			}
		} else {
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

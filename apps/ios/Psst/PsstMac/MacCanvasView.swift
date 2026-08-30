import SwiftUI
import WebKit

/// The shared web canvas, hosted in the panel.
struct MacCanvasView: NSViewRepresentable {
	@Environment(AppState.self) private var appState

	func makeCoordinator() -> WebCanvasCoordinator {
		let appState = self.appState
		return WebCanvasCoordinator(
			onSessionExpired: { appState.signOut() },
			// The panel is for canvas-shaped pages; full-page experiences
			// (settings, timeline, legal) belong in a real browser window.
			opensExternally: { url in
				let parts = url.pathComponents
				if parts.count >= 4, parts[1] == "spaces" { return true }
				return ["/privacy", "/terms", "/design"].contains(url.path())
			},
		)
	}

	func makeNSView(context: Context) -> WKWebView {
		WebCanvas.makeWebView(coordinator: context.coordinator)
	}

	func updateNSView(_ webView: WKWebView, context: Context) {}
}

import SwiftUI
import WebKit

/// The shared web canvas, hosted in the panel. The page's own title
/// ("🌷 our corner — psst") becomes the window title.
struct MacCanvasView: NSViewRepresentable {
	@Environment(AppState.self) private var appState

	final class Coordinator {
		let web: WebCanvasCoordinator
		var titleObservation: NSKeyValueObservation?

		init(web: WebCanvasCoordinator) {
			self.web = web
		}
	}

	func makeCoordinator() -> Coordinator {
		let appState = self.appState
		return Coordinator(
			web: WebCanvasCoordinator(
				onSessionExpired: { appState.signOut() },
				// The panel is for canvas-shaped pages; full-page experiences
				// (settings, timeline, legal) belong in a real browser window.
				opensExternally: { url in
					let parts = url.pathComponents
					if parts.count >= 4, parts[1] == "spaces" { return true }
					return ["/privacy", "/terms", "/design"].contains(url.path())
				},
			),
		)
	}

	func makeNSView(context: Context) -> WKWebView {
		let webView = WebCanvas.makeWebView(coordinator: context.coordinator.web)
		context.coordinator.titleObservation = webView.observe(\.title) { view, _ in
			let title = view.title ?? ""
			view.window?.title = title.isEmpty ? "psst" : title
		}
		return webView
	}

	func updateNSView(_ webView: WKWebView, context: Context) {}
}

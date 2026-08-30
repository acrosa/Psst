import SwiftUI
import WebKit

/// The shared web canvas, hosted in the panel.
struct MacCanvasView: NSViewRepresentable {
	@Environment(AppState.self) private var appState

	func makeCoordinator() -> WebCanvasCoordinator {
		let appState = self.appState
		return WebCanvasCoordinator(onSessionExpired: { appState.signOut() })
	}

	func makeNSView(context: Context) -> WKWebView {
		WebCanvas.makeWebView(coordinator: context.coordinator)
	}

	func updateNSView(_ webView: WKWebView, context: Context) {}
}

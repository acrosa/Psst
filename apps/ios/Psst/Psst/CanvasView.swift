import SwiftUI
import WebKit

/// The canvas: the shared web board in a WKWebView. Native owns push + widget;
/// the web mobile UI owns the board.
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

	func makeCoordinator() -> WebCanvasCoordinator {
		WebCanvasCoordinator(onSessionExpired: onSessionExpired)
	}

	func makeUIView(context: Context) -> WKWebView {
		WebCanvas.makeWebView(coordinator: context.coordinator)
	}

	func updateUIView(_ webView: WKWebView, context: Context) {
		// A push was tapped: jump to that space.
		if let spaceId = pendingSpaceId {
			webView.load(URLRequest(url: Config.baseURL.appending(path: "/spaces/\(spaceId)")))
			onNavigatedToPending()
		}
	}
}

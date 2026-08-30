import SwiftUI

/// What lives inside the panel: the canvas when signed in, the login when not.
/// Content springs in a beat after the panel settles — the table being set.
struct MacRootView: View {
	@Environment(AppState.self) private var appState
	let contentVisible: () -> Bool

	@State private var revealed = false

	var body: some View {
		VStack(spacing: 0) {
			// The grab strip — drag here to pull the panel off the menu bar.
			ZStack {
				PsstColor.paper
				Capsule()
					.fill(PsstColor.inkFaint.opacity(0.7))
					.frame(width: 36, height: 4)
			}
			.frame(height: 18)
			.overlay(DragHandle())

			Group {
				if appState.isSignedIn {
					MacCanvasView()
				} else {
					LoginView()
				}
			}
		}
		.frame(minWidth: 360, minHeight: 420)
		.background(PsstColor.paper)
		.opacity(revealed ? 1 : 0)
		.scaleEffect(revealed ? 1 : 0.97, anchor: .top)
		.onAppear { revealed = contentVisible() }
		.onReceive(NotificationCenter.default.publisher(for: .panelContentVisible)) { _ in
			withAnimation(.spring(duration: 0.35, bounce: 0.15)) {
				revealed = true
			}
		}
	}
}

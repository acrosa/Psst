import Observation

/// App-wide session + navigation state, shared by the iOS and macOS shells.
@Observable
final class AppState {
	var isSignedIn: Bool = SessionStore.bearerToken != nil
	/// Set when a push is tapped; the canvas navigates to this space.
	var pendingSpaceId: String?
	/// Platform hook — extra teardown on sign-out (push unregister on iOS).
	@ObservationIgnored var onSignOut: (() -> Void)?

	func signedIn(with bearer: String) {
		SessionStore.bearerToken = bearer
		isSignedIn = true
	}

	func signOut() {
		onSignOut?()
		SessionStore.clear()
		Config.lastSpaceId = nil
		isSignedIn = false
	}
}

import Observation

/// App-wide session + navigation state, shared by the iOS and macOS shells.
@Observable
final class AppState {
	var isSignedIn: Bool = SessionStore.bearerToken != nil
	/// Set when a push is tapped; the canvas navigates to this space.
	var pendingSpaceId: String?
	/// Which board to show after sign-in. The server's kill switch can change
	/// it live; everything else settles at launch.
	var boardExperience: BoardExperience = .current
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

	/// Ask the server what it says about the native board, cache the answer
	/// (so an `off` holds offline), and follow it — along with the Settings
	/// toggle, which may have flipped while psst was away. Quiet on failure.
	@MainActor
	func refreshBoardFlag() async {
		if isSignedIn, let me = try? await APIClient().me() {
			Config.remoteNativeBoard = me.flags.nativeBoard
		}
		let next = BoardExperience.current
		if next != boardExperience { boardExperience = next }
	}
}

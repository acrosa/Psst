import GridKit
import Observation
import SwiftUI
import UserNotifications
import WidgetKit

@main
struct PsstApp: App {
	@UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
	@Environment(\.scenePhase) private var scenePhase
	@State private var appState = AppState()

	init() {
		PsstFont.register()
	}

	var body: some Scene {
		WindowGroup {
			Group {
				if appState.isSignedIn {
					// The web board stays one case away (docs/NATIVE_IOS.md §2).
					switch appState.boardExperience {
					case .native: NativeRoot()
					case .web: CanvasView()
					}
				} else {
					LoginView()
				}
			}
			.environment(appState)
			.onAppear {
				appDelegate.appState = appState
				// The shared AppState doesn't know about push — unhook on sign-out.
				appState.onSignOut = {
					if let token = PushManager.shared.deviceToken {
						let api = PsstAPI()
						Task { await api.registerDevice(token: token, remove: true) }
					}
				}
			}
			.onChange(of: scenePhase) { _, phase in
				if phase == .background { WidgetCenter.shared.reloadAllTimelines() }
				if phase == .active { Task { await appState.refreshBoardFlag() } }
			}
			.task(id: appState.isSignedIn) { await appState.refreshBoardFlag() }
			// Development grid overlay — a no-op in release builds.
			.gridKit(.enabled(activation: .threeFingerLongPress, initialPreset: PsstGrid.preset))
		}
	}
}

/// UIKit bridge: APNs registration + notification taps.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
	weak var appState: AppState?

	func application(
		_ application: UIApplication,
		didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil,
	) -> Bool {
		UNUserNotificationCenter.current().delegate = self
		return true
	}

	func application(
		_ application: UIApplication,
		didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data,
	) {
		let token = deviceToken.map { String(format: "%02x", $0) }.joined()
		PushManager.shared.deviceToken = token
		let api = PsstAPI()
		Task { await api.registerDevice(token: token) }
	}

	func application(
		_ application: UIApplication,
		didFailToRegisterForRemoteNotificationsWithError error: Error,
	) {
		print("[push] registration failed: \(error.localizedDescription)")
	}

	/// Pushes arriving in the foreground still whisper.
	nonisolated func userNotificationCenter(
		_ center: UNUserNotificationCenter,
		willPresent notification: UNNotification,
	) async -> UNNotificationPresentationOptions {
		[.banner, .sound]
	}

	nonisolated func userNotificationCenter(
		_ center: UNUserNotificationCenter,
		didReceive response: UNNotificationResponse,
	) async {
		let userInfo = response.notification.request.content.userInfo
		guard let spaceId = userInfo["spaceId"] as? String else { return }
		await MainActor.run { self.appState?.pendingSpaceId = spaceId }
	}
}

import UIKit
import UserNotifications

/// Asks for notification permission and keeps the APNs token around so
/// sign-out can unregister it.
final class PushManager {
	static let shared = PushManager()
	var deviceToken: String?

	/// Request permission (once) and register with APNs.
	func enable() {
		Task {
			let center = UNUserNotificationCenter.current()
			let settings = await center.notificationSettings()
			switch settings.authorizationStatus {
			case .notDetermined:
				let granted =
					(try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
				if granted { UIApplication.shared.registerForRemoteNotifications() }
			case .authorized, .provisional, .ephemeral:
				UIApplication.shared.registerForRemoteNotifications()
			default:
				break
			}
		}
	}
}

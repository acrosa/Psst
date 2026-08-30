import SwiftUI

/// psst for the Mac: nothing but a whisper in the menu bar. The status item
/// and its panel are pure AppKit (a resizable, animated NSPanel); SwiftUI
/// renders everything inside it.
@main
struct PsstMacApp: App {
	@NSApplicationDelegateAdaptor(MacAppDelegate.self) private var appDelegate

	var body: some Scene {
		Settings {
			EmptyView()
		}
	}
}

final class MacAppDelegate: NSObject, NSApplicationDelegate {
	private var statusController: StatusItemController?

	func applicationDidFinishLaunching(_ notification: Notification) {
		statusController = StatusItemController()
	}
}

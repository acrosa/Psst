import AppKit
import Observation
import SwiftUI

/// The whole mac app, from the menu bar's point of view: the icon, the unread
/// count beside it, the panel it opens, and the little right-click menu.
final class StatusItemController: NSObject {
	private let appState = AppState()
	private let tracker = UnreadTracker()
	private let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
	private lazy var panelController = PanelController(appState: appState)

	override init() {
		super.init()

		if let button = statusItem.button {
			button.image = NSImage(
				systemSymbolName: "rectangle.3.group",
				accessibilityDescription: "psst",
			)
			button.image?.isTemplate = true
			button.imagePosition = .imageLeft
			button.target = self
			button.action = #selector(statusItemClicked)
			button.sendAction(on: [.leftMouseUp, .rightMouseUp])
		}

		tracker.onChange = { [weak self] count in
			self?.renderBadge(count)
		}
		tracker.onSessionExpired = { [weak self] in
			self?.appState.signOut()
		}
		panelController.onOpenStateChange = { [weak self] open in
			open ? self?.tracker.pause() : self?.tracker.resume()
		}

		NSWorkspace.shared.notificationCenter.addObserver(
			self,
			selector: #selector(didWake),
			name: NSWorkspace.didWakeNotification,
			object: nil,
		)

		observeSession()
		if appState.isSignedIn {
			tracker.start()
		}
	}

	// MARK: Session

	private func observeSession() {
		withObservationTracking {
			_ = appState.isSignedIn
		} onChange: { [weak self] in
			Task { @MainActor in
				guard let self else { return }
				if self.appState.isSignedIn {
					self.tracker.forgetUser()
					self.tracker.start()
				} else {
					self.tracker.stop()
					self.tracker.forgetUser()
				}
				self.panelController.refreshContent()
				self.observeSession()
			}
		}
	}

	// MARK: Badge

	private func renderBadge(_ count: Int) {
		guard let button = statusItem.button else { return }
		if count <= 0 {
			button.attributedTitle = NSAttributedString(string: "")
			return
		}
		let label = count > 9 ? "9+" : "\(count)"
		button.attributedTitle = NSAttributedString(
			string: " \(label)",
			attributes: [
				.font: NSFont.monospacedDigitSystemFont(ofSize: 11, weight: .semibold),
				.baselineOffset: 1,
			],
		)
	}

	// MARK: Clicks

	@objc private func statusItemClicked() {
		guard let button = statusItem.button, let event = NSApp.currentEvent else { return }
		if event.type == .rightMouseUp {
			showMenu()
		} else {
			panelController.toggle(from: button)
		}
	}

	private func showMenu() {
		let menu = NSMenu()
		let open = NSMenuItem(title: "Open psst", action: #selector(openWeb), keyEquivalent: "")
		open.target = self
		menu.addItem(open)
		menu.addItem(.separator())
		if appState.isSignedIn {
			let signOut = NSMenuItem(title: "Sign out", action: #selector(signOut), keyEquivalent: "")
			signOut.target = self
			menu.addItem(signOut)
		}
		let quit = NSMenuItem(title: "Quit psst", action: #selector(quit), keyEquivalent: "q")
		quit.target = self
		menu.addItem(quit)

		statusItem.menu = menu
		statusItem.button?.performClick(nil)
		statusItem.menu = nil
	}

	@objc private func openWeb() {
		let path = Config.lastSpaceId.map { "/spaces/\($0)" } ?? "/spaces"
		NSWorkspace.shared.open(Config.baseURL.appending(path: path))
	}

	@objc private func signOut() {
		appState.signOut()
	}

	@objc private func quit() {
		NSApp.terminate(nil)
	}

	@objc private func didWake() {
		tracker.poll()
	}
}

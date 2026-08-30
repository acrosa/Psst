import AppKit
import SwiftUI

/// The canvas as a floating panel: grows out of the menu bar, tucks back in.
/// Resizable, and it remembers the size you like.
final class CanvasPanel: NSPanel {
	override var canBecomeKey: Bool { true }

	override func cancelOperation(_ sender: Any?) {
		(delegate as? PanelController)?.close()
	}
}

final class PanelController: NSObject, NSWindowDelegate {
	var onOpenStateChange: ((Bool) -> Void)?

	private let appState: AppState
	private var panel: CanvasPanel?
	private var outsideClickMonitor: Any?
	private var contentVisible = false

	private static let sizeKey = "panelSize"
	private static let defaultSize = NSSize(width: 480, height: 620)
	private static let minSize = NSSize(width: 360, height: 420)

	private(set) var isOpen = false

	init(appState: AppState) {
		self.appState = appState
	}

	// MARK: Size memory

	private var preferredSize: NSSize {
		get {
			guard let stored = UserDefaults.standard.string(forKey: Self.sizeKey) else {
				return Self.defaultSize
			}
			let size = NSSizeFromString(stored)
			return size.width >= Self.minSize.width && size.height >= Self.minSize.height
				? size
				: Self.defaultSize
		}
		set { UserDefaults.standard.set(NSStringFromSize(newValue), forKey: Self.sizeKey) }
	}

	func windowDidEndLiveResize(_ notification: Notification) {
		if let panel { preferredSize = panel.frame.size }
	}

	func windowDidResignKey(_ notification: Notification) {
		close()
	}

	// MARK: Open / close

	func toggle(from button: NSStatusBarButton) {
		isOpen ? close() : open(from: button)
	}

	func open(from button: NSStatusBarButton) {
		guard !isOpen else { return }
		let panel = ensurePanel()
		guard let anchor = anchorFrame(for: button) else { return }

		let final = finalFrame(anchoredTo: anchor)
		isOpen = true
		onOpenStateChange?(true)

		if reduceMotion {
			panel.setFrame(final, display: false)
			panel.alphaValue = 0
			panel.makeKeyAndOrderFront(nil)
			NSAnimationContext.runAnimationGroup { context in
				context.duration = 0.15
				panel.animator().alphaValue = 1
			}
			revealContent()
		} else {
			// Grow out of the menu bar: start as a sliver under the icon.
			let sliver = NSRect(
				x: anchor.midX - 22,
				y: final.maxY - 36,
				width: 44,
				height: 36,
			)
			panel.setFrame(sliver, display: false)
			panel.alphaValue = 0
			panel.makeKeyAndOrderFront(nil)
			NSAnimationContext.runAnimationGroup(
				{ context in
					context.duration = 0.30
					context.timingFunction = CAMediaTimingFunction(controlPoints: 0.19, 1.0, 0.22, 1.0)
					panel.animator().setFrame(final, display: true)
					panel.animator().alphaValue = 1
				},
				completionHandler: { [weak self] in
					self?.revealContent()
				},
			)
		}
		installOutsideClickMonitor()
	}

	func close() {
		guard isOpen, let panel else { return }
		isOpen = false
		onOpenStateChange?(false)
		removeOutsideClickMonitor()
		preferredSize = panel.frame.size
		hideContent()

		let current = panel.frame
		let tucked = NSRect(
			x: current.midX - current.width * 0.4,
			y: current.maxY - current.height * 0.8,
			width: current.width * 0.8,
			height: current.height * 0.8,
		)
		NSAnimationContext.runAnimationGroup(
			{ context in
				context.duration = reduceMotion ? 0.12 : 0.16
				context.timingFunction = CAMediaTimingFunction(name: .easeIn)
				if !reduceMotion { panel.animator().setFrame(tucked, display: true) }
				panel.animator().alphaValue = 0
			},
			completionHandler: {
				panel.orderOut(nil)
				panel.setFrame(NSRect(origin: current.origin, size: current.size), display: false)
			},
		)
	}

	// MARK: Panel plumbing

	private func ensurePanel() -> CanvasPanel {
		if let panel { return panel }
		let panel = CanvasPanel(
			contentRect: NSRect(origin: .zero, size: preferredSize),
			styleMask: [.titled, .closable, .resizable, .fullSizeContentView, .nonactivatingPanel],
			backing: .buffered,
			defer: true,
		)
		panel.titleVisibility = .hidden
		panel.titlebarAppearsTransparent = true
		panel.standardWindowButton(.closeButton)?.isHidden = true
		panel.standardWindowButton(.miniaturizeButton)?.isHidden = true
		panel.standardWindowButton(.zoomButton)?.isHidden = true
		panel.isMovableByWindowBackground = false
		panel.level = .floating
		panel.collectionBehavior = [.moveToActiveSpace, .fullScreenAuxiliary]
		panel.minSize = Self.minSize
		panel.isReleasedWhenClosed = false
		panel.hidesOnDeactivate = false
		panel.backgroundColor = .clear
		panel.hasShadow = true
		panel.delegate = self

		let root = MacRootView(contentVisible: { [weak self] in self?.contentVisible ?? true })
			.environment(appState)
		let hosting = NSHostingView(rootView: AnyView(root))
		hosting.wantsLayer = true
		hosting.layer?.cornerRadius = 14
		hosting.layer?.masksToBounds = true
		panel.contentView = hosting
		self.panel = panel
		return panel
	}

	/// Rebuild content (e.g. after sign-in/out) by swapping the hosting view.
	func refreshContent() {
		guard let panel else { return }
		let root = MacRootView(contentVisible: { [weak self] in self?.contentVisible ?? true })
			.environment(appState)
		let hosting = NSHostingView(rootView: AnyView(root))
		hosting.wantsLayer = true
		hosting.layer?.cornerRadius = 14
		hosting.layer?.masksToBounds = true
		panel.contentView = hosting
	}

	private func anchorFrame(for button: NSStatusBarButton) -> NSRect? {
		button.window?.frame
	}

	private func finalFrame(anchoredTo anchor: NSRect) -> NSRect {
		let size = preferredSize
		let screen = NSScreen.screens.first { $0.frame.intersects(anchor) } ?? NSScreen.main
		let visible = screen?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
		var x = anchor.midX - size.width / 2
		x = min(max(x, visible.minX + 8), visible.maxX - size.width - 8)
		let y = min(anchor.minY, visible.maxY) - 6 - size.height
		return NSRect(x: x, y: max(y, visible.minY + 8), width: size.width, height: size.height)
	}

	private var reduceMotion: Bool {
		NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
	}

	// MARK: Content reveal (the inner spring)

	private func revealContent() {
		contentVisible = true
		NotificationCenter.default.post(name: .panelContentVisible, object: nil)
	}

	private func hideContent() {
		contentVisible = false
	}

	// MARK: Dismissal

	private func installOutsideClickMonitor() {
		removeOutsideClickMonitor()
		outsideClickMonitor = NSEvent.addGlobalMonitorForEvents(
			matching: [.leftMouseDown, .rightMouseDown],
		) { [weak self] _ in
			self?.close()
		}
	}

	private func removeOutsideClickMonitor() {
		if let monitor = outsideClickMonitor {
			NSEvent.removeMonitor(monitor)
			outsideClickMonitor = nil
		}
	}
}

extension Notification.Name {
	static let panelContentVisible = Notification.Name("app.psst.panelContentVisible")
}

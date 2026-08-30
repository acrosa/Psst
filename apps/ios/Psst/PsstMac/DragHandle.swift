import AppKit
import SwiftUI

/// The panel's grab strip: a native view that hands the mouse straight to
/// window dragging — the webview below claims every event, so the window
/// needs one surface of its own to be moved by.
struct DragHandle: NSViewRepresentable {
	func makeNSView(context: Context) -> DragHandleView {
		DragHandleView()
	}

	func updateNSView(_ view: DragHandleView, context: Context) {}
}

final class DragHandleView: NSView {
	override func mouseDown(with event: NSEvent) {
		window?.performDrag(with: event)
	}
}

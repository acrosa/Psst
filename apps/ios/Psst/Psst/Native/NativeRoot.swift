import SwiftUI

/// The native board's root (docs/NATIVE_IOS.md). Phase 0 lays the table:
/// the switch, the API, the tokens and the type are in place; the board
/// itself arrives in Phase 1. Until then this is a quiet placeholder that
/// proves the switch — and says how to get back to the web board.
struct NativeRoot: View {
	@Environment(AppState.self) private var appState

	var body: some View {
		VStack(alignment: .leading, spacing: 8) {
			Text("psst")
				.font(PsstFont.whisper(DesignTokens.TextSize.xl2, relativeTo: .largeTitle))
			Text("setting the table…")
				.font(PsstFont.whisper(DesignTokens.TextSize.xl, relativeTo: .title))
				.foregroundStyle(PsstColor.inkSoft)
			Text("The native board is on its way. Turn off Native board in Settings → psst to return to today’s board.")
				.font(PsstFont.ui(DesignTokens.TextSize.sm, relativeTo: .subheadline))
				.foregroundStyle(PsstColor.inkSoft)
				.padding(.top, 16)
		}
		.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
		.padding(.horizontal, 24)
		.background(PsstColor.paper)
		.foregroundStyle(PsstColor.ink)
		.task {
			// Ask for the psst sound once the board is on screen, as the web shell does.
			PushManager.shared.enable()
		}
	}
}

#Preview {
	NativeRoot().environment(AppState())
}

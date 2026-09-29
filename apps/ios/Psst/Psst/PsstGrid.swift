import Foundation
import GridKit

/// psst's grid for GridKit (docs/DESIGN.md § Grid): the same
/// `design/grid/psst.json` the web overlay loads, copied into the bundle by
/// `pnpm tokens`. Summon it with a three-finger long press (DEBUG builds).
enum PsstGrid {
	static let preset: GridPreset? = {
		guard let url = Bundle.main.url(forResource: "psst-grid", withExtension: "json"),
			let data = try? Data(contentsOf: url),
			let grid = try? JSONDecoder().decode(GridConfiguration.self, from: data)
		else { return nil }
		return GridPreset(
			id: "psst",
			name: "psst",
			category: .appLayouts,
			configuration: grid,
			compactConfiguration: grid,
			notes: "4 pt baseline (16 pt beat), 4 columns inside 24 pt margins, key lines at the header and the composer.",
		)
	}()
}

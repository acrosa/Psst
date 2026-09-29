import { GridKitOverlay, type GridPreset, parseConfiguration } from 'gridkit-react';
import psstGrid from '../../../../design/grid/psst.json';

const grid = parseConfiguration(psstGrid);

/** psst's own grid, first in line — the panel still offers every other preset. */
const PSST_GRID: GridPreset = {
	id: 'psst',
	name: 'psst',
	category: 'appLayouts',
	configuration: grid,
	compactConfiguration: grid,
	notes:
		'4 pt baseline (16 pt beat), 4 columns inside 24 pt margins, key lines at the header and the composer. docs/DESIGN.md § Grid.',
};

export default function DevGridOverlay() {
	return <GridKitOverlay initialPreset={PSST_GRID} enabled />;
}

import type { BoardItem } from '~/lib/services/canvases.server';

/**
 * A board item with nothing behind it — for the landing playground and the
 * lost-page canvas. Never fetched, never saved.
 */
export function demoItem(partial: Partial<BoardItem> & Pick<BoardItem, 'id' | 'type'>): BoardItem {
	return {
		url: null,
		text: null,
		x: 0,
		y: 0,
		z: 0,
		rotation: 0,
		scale: 1,
		authorId: 'demo-ale',
		authorName: 'Ale',
		createdAt: '2026-08-29T09:00:00.000Z',
		unfurl: null,
		assets: [],
		comments: [],
		reactions: [],
		...partial,
	};
}

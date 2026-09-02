import {
	Background,
	BackgroundVariant,
	type Node,
	ReactFlow,
	ReactFlowProvider,
	applyNodeChanges,
	useReactFlow,
} from '@xyflow/react';
import { useRef, useState } from 'react';
import { PencilIcon } from '~/components/icons';
import type { BoardItem } from '~/lib/services/canvases.server';
import { DrawLayer, PENCIL_COLORS, type Stroke } from './composer';
import { demoItem } from './demo-item';
import { AudioNode, DrawingNode, PostcardNode, SlipNode, StickerNode } from './nodes';

import '@xyflow/react/dist/style.css';

/**
 * The landing page's playground: the real board nodes over demo items.
 * Positions, likes, and pencil drawings live in component state — nothing
 * is fetched, posted, or persisted.
 */

const VISITOR = 'visitor';

const nodeTypes = {
	link: PostcardNode,
	note: SlipNode,
	emoji: StickerNode,
	drawing: DrawingNode,
	audio: AudioNode,
};

const heart =
	'M 70 96 C 40 76 18 58 22 38 C 25 22 44 16 56 26 C 63 32 68 40 70 46 C 72 40 77 32 84 26 C 96 16 115 22 118 38 C 122 58 100 76 70 96 Z';

const demoItems: Array<{ item: BoardItem; position: { x: number; y: number } }> = [
	{
		position: { x: -700, y: -420 },
		item: demoItem({
			id: 'demo-note-six',
			type: 'note',
			text: 'meet you at six?',
			rotation: -2,
		}),
	},
	{
		position: { x: 300, y: 250 },
		item: demoItem({
			id: 'demo-note-drag',
			type: 'note',
			text: 'psst — everything here is draggable (double-tap to like)',
			rotation: 1.5,
			authorId: 'demo-brendi',
			authorName: 'Brendi',
		}),
	},
	{
		position: { x: 380, y: -360 },
		item: demoItem({
			id: 'demo-link-bakery',
			type: 'link',
			url: 'https://maps.app/the-bakery-around-the-corner',
			rotation: 2,
			unfurl: {
				title: 'the bakery around the corner',
				description: 'open till six — the croissants go early.',
				imageUrl: null,
				faviconUrl: null,
				siteName: 'maps.app',
				status: 'ok',
			},
			reactions: [{ emoji: '🔥', userId: 'demo-brendi' }],
			comments: [
				{
					id: 'demo-comment-1',
					authorId: 'demo-brendi',
					authorName: 'Brendi',
					authorImage: null,
					text: 'saturday?',
					createdAt: '2026-08-29T09:05:00.000Z',
				},
			],
		}),
	},
	{
		position: { x: -680, y: 500 },
		item: demoItem({
			id: 'demo-audio',
			type: 'audio',
			text: JSON.stringify({
				duration: 7,
				peaks: [
					0.3, 0.7, 0.45, 0.9, 0.35, 0.75, 0.5, 1, 0.4, 0.6, 0.28, 0.8, 0.5, 0.33, 0.65, 0.42, 0.88,
					0.36, 0.7, 0.48, 0.58, 0.3, 0.52, 0.26,
				],
			}),
			rotation: -1,
			authorId: 'demo-brendi',
			authorName: 'Brendi',
		}),
	},
	{
		position: { x: -800, y: 60 },
		item: demoItem({
			id: 'demo-drawing-heart',
			type: 'drawing',
			text: JSON.stringify({ color: PENCIL_COLORS[0], d: heart, w: 140, h: 110 }),
		}),
	},
	{
		position: { x: 560, y: 40 },
		item: demoItem({ id: 'demo-sticker-frog', type: 'emoji', text: '🐸', rotation: 3 }),
	},
	{
		position: { x: 240, y: -470 },
		item: demoItem({ id: 'demo-sticker-berry', type: 'emoji', text: '🍓', rotation: -6 }),
	},
	{
		position: { x: -300, y: 430 },
		item: demoItem({ id: 'demo-sticker-star', type: 'emoji', text: '⭐', rotation: 8 }),
	},
];

function toggleLike(item: BoardItem): BoardItem {
	const mine = item.reactions.some((r) => r.userId === VISITOR && r.emoji === '🫶');
	return {
		...item,
		reactions: mine
			? item.reactions.filter((r) => !(r.userId === VISITOR && r.emoji === '🫶'))
			: [...item.reactions, { emoji: '🫶', userId: VISITOR }],
	};
}

function DemoBoardInner() {
	const { screenToFlowPosition } = useReactFlow();
	const [drawing, setDrawing] = useState(false);
	const [strokes, setStrokes] = useState<Stroke[]>([]);
	const settleTimer = useRef<number | null>(null);

	const [nodes, setNodes] = useState<Node[]>(() => {
		const onLike = (itemId: string) => {
			setNodes((prev) =>
				prev.map((node) =>
					node.id === itemId
						? { ...node, data: { ...node.data, item: toggleLike(node.data.item as BoardItem) } }
						: node,
				),
			);
		};
		return demoItems.map(({ item, position }) => ({
			id: item.id,
			type: item.type,
			position,
			data: { item, currentUserId: VISITOR, frozen: true, onLike },
		}));
	});

	function commitStrokes(current: Stroke[]) {
		if (settleTimer.current) {
			window.clearTimeout(settleTimer.current);
			settleTimer.current = null;
		}
		if (current.length > 0) {
			const flowStrokes = current.map((stroke) => stroke.map((p) => screenToFlowPosition(p)));
			const points = flowStrokes.flat();
			const pad = 8;
			const minX = Math.min(...points.map((p) => p.x)) - pad;
			const minY = Math.min(...points.map((p) => p.y)) - pad;
			const maxX = Math.max(...points.map((p) => p.x)) + pad;
			const maxY = Math.max(...points.map((p) => p.y)) + pad;
			const r = (n: number) => Math.round(n * 10) / 10;
			const d = flowStrokes
				.map((stroke) => `M ${stroke.map((p) => `${r(p.x - minX)} ${r(p.y - minY)}`).join(' L ')}`)
				.join(' ');
			const item = demoItem({
				id: `demo-drawing-${Date.now()}`,
				type: 'drawing',
				text: JSON.stringify({
					color: PENCIL_COLORS[0],
					d,
					w: Math.max(8, Math.round(maxX - minX)),
					h: Math.max(8, Math.round(maxY - minY)),
				}),
				authorId: VISITOR,
				authorName: 'you',
			});
			setNodes((prev) => [
				...prev,
				{
					id: item.id,
					type: 'drawing',
					position: { x: minX, y: minY },
					data: { item, currentUserId: VISITOR, frozen: true },
				},
			]);
		}
		setStrokes([]);
	}

	function addStroke(stroke: Stroke) {
		setStrokes((prev) => {
			const next = [...prev, stroke];
			if (settleTimer.current) window.clearTimeout(settleTimer.current);
			settleTimer.current = window.setTimeout(() => commitStrokes(next), 1400);
			return next;
		});
	}

	return (
		<div className="relative h-full w-full">
			<ReactFlow
				nodes={nodes}
				onNodesChange={(changes) => setNodes((prev) => applyNodeChanges(changes, prev))}
				nodeTypes={nodeTypes}
				nodesConnectable={false}
				nodesDraggable
				panOnDrag={false}
				zoomOnScroll={false}
				zoomOnPinch={false}
				zoomOnDoubleClick={false}
				preventScrolling={false}
				proOptions={{ hideAttribution: true }}
				fitView
				fitViewOptions={{ padding: 0.05 }}
				minZoom={0.2}
			>
				<Background
					variant={BackgroundVariant.Dots}
					gap={30}
					size={1.5}
					color="var(--color-line)"
				/>
			</ReactFlow>
			{drawing ? (
				<DrawLayer color={PENCIL_COLORS[0]} strokes={strokes} onStroke={addStroke} />
			) : null}
			<button
				type="button"
				aria-label={drawing ? 'Stop drawing' : 'Draw on this page'}
				aria-pressed={drawing}
				onClick={() => {
					if (drawing) commitStrokes(strokes);
					setDrawing((prev) => !prev);
				}}
				className={`absolute right-6 bottom-6 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-line shadow-card transition ${
					drawing ? 'bg-accent text-white' : 'bg-card text-ink-soft hover:text-ink'
				}`}
			>
				<PencilIcon className="h-4.5 w-4.5" />
			</button>
		</div>
	);
}

export function DemoBoard() {
	return (
		<ReactFlowProvider>
			<DemoBoardInner />
		</ReactFlowProvider>
	);
}

import {
	Background,
	BackgroundVariant,
	type Node,
	type NodeProps,
	ReactFlow,
	applyNodeChanges,
} from '@xyflow/react';
import { useCallback, useState } from 'react';
import { tornEdge } from './nodes';

import '@xyflow/react/dist/style.css';

/**
 * The landing page's playground: real materials, nothing real behind them.
 * Positions live in component state, reactions are a puff of local delight —
 * nothing is fetched, posted, or persisted.
 */

type DemoData = { burst?: number };

function DemoSlip({ data }: NodeProps<Node<DemoData & { text: string; tone: string }>>) {
	return (
		<Burstable burst={data.burst}>
			<div className="relative h-[120px] w-[220px]">
				<svg
					viewBox="0 0 220 120"
					className="absolute inset-0 h-full w-full [filter:drop-shadow(0_3px_7px_rgb(64_56_47/0.16))]"
					aria-hidden="true"
				>
					<path d={tornEdge(data.text, 220, 120)} fill={data.tone} />
				</svg>
				<span
					aria-hidden
					className="-top-2.5 -translate-x-1/2 absolute left-1/2 h-6 w-20 rotate-[-2deg] bg-butter/70 shadow-sm"
				/>
				<p className="relative px-5 py-6 font-mono text-[13px] text-ink leading-relaxed">
					{data.text}
				</p>
			</div>
		</Burstable>
	);
}

function DemoSticker({ data }: NodeProps<Node<DemoData & { emoji: string }>>) {
	return (
		<Burstable burst={data.burst}>
			<span className="block text-6xl [filter:drop-shadow(0_4px_8px_rgb(64_56_47/0.2))]">
				{data.emoji}
			</span>
		</Burstable>
	);
}

function DemoDrawing({ data }: NodeProps<Node<DemoData & { d: string; color: string }>>) {
	return (
		<svg viewBox="0 0 140 110" className="h-[110px] w-[140px]" aria-hidden="true">
			<path
				d={data.d}
				stroke={data.color}
				strokeWidth={3.5}
				strokeLinecap="round"
				strokeLinejoin="round"
				fill="none"
			/>
		</svg>
	);
}

function DemoAudio({ data }: NodeProps<Node<DemoData>>) {
	const bars = [8, 16, 11, 22, 9, 18, 13, 24, 10, 15, 7, 19, 12, 8];
	return (
		<Burstable burst={data.burst}>
			<div className="flex h-[64px] w-[230px] items-center gap-3.5 rounded-[22px] bg-card px-4 shadow-card">
				<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white">
					<svg viewBox="0 0 12 14" className="ml-0.5 h-3.5 w-3.5 fill-current" aria-hidden="true">
						<path d="M0 0 L12 7 L0 14 Z" />
					</svg>
				</span>
				<span className="flex flex-1 items-center gap-[3px]">
					{bars.map((height, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static decoration
						<span key={index} className="w-[3px] rounded-full bg-ink/60" style={{ height }} />
					))}
				</span>
				<span className="font-mono text-[11px] text-ink-faint">0:07</span>
			</div>
		</Burstable>
	);
}

function DemoPostcard({ data }: NodeProps<Node<DemoData & { title: string; domain: string }>>) {
	return (
		<Burstable burst={data.burst}>
			<div className="w-[240px] overflow-hidden rounded-lg border border-line bg-card shadow-card">
				<div className="h-[110px] bg-gradient-to-br from-sky via-meadow to-butter" />
				<div className="space-y-1 p-3">
					<p className="font-medium text-[13px] text-ink leading-snug">{data.title}</p>
					<p className="font-mono text-[10px] text-ink-faint uppercase tracking-wide">
						{data.domain}
					</p>
				</div>
			</div>
		</Burstable>
	);
}

/** Double-tap delight: a heart pops and fades, then is forgotten. */
function Burstable({ burst, children }: { burst?: number; children: React.ReactNode }) {
	return (
		<div className="relative">
			{children}
			{burst ? (
				<span
					key={burst}
					className="-top-6 -translate-x-1/2 pointer-events-none absolute left-1/2 text-3xl"
					style={{ animation: 'like-burst 0.9s ease-out forwards' }}
				>
					🫶
				</span>
			) : null}
		</div>
	);
}

const nodeTypes = {
	slip: DemoSlip,
	sticker: DemoSticker,
	drawing: DemoDrawing,
	audio: DemoAudio,
	postcard: DemoPostcard,
};

const heart =
	'M 70 96 C 40 76 18 58 22 38 C 25 22 44 16 56 26 C 63 32 68 40 70 46 C 72 40 77 32 84 26 C 96 16 115 22 118 38 C 122 58 100 76 70 96 Z';

const initialNodes: Node[] = [
	{
		id: 'slip-1',
		type: 'slip',
		position: { x: -700, y: -420 },
		data: { text: 'meet you at six?', tone: 'var(--color-card)' },
	},
	{
		id: 'slip-2',
		type: 'slip',
		position: { x: 300, y: 250 },
		data: { text: 'psst — everything here is draggable', tone: 'var(--color-sky)' },
	},
	{
		id: 'postcard-1',
		type: 'postcard',
		position: { x: 380, y: -360 },
		data: { title: 'the bakery around the corner', domain: 'maps.app' },
	},
	{
		id: 'audio-1',
		type: 'audio',
		position: { x: -680, y: 500 },
		data: {},
	},
	{
		id: 'drawing-1',
		type: 'drawing',
		position: { x: -800, y: 60 },
		data: { d: heart, color: 'var(--color-accent)' },
	},
	{ id: 'sticker-1', type: 'sticker', position: { x: 560, y: 40 }, data: { emoji: '🐸' } },
	{ id: 'sticker-2', type: 'sticker', position: { x: 240, y: -470 }, data: { emoji: '🍓' } },
	{ id: 'sticker-3', type: 'sticker', position: { x: -300, y: 430 }, data: { emoji: '⭐' } },
];

export function DemoBoard() {
	const [nodes, setNodes] = useState(initialNodes);

	const burst = useCallback((_event: React.MouseEvent, node: Node) => {
		setNodes((prev) =>
			prev.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, burst: Date.now() } } : n)),
		);
	}, []);

	return (
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
			fitViewOptions={{ padding: 0.1 }}
			onNodeDoubleClick={burst}
		>
			<Background variant={BackgroundVariant.Dots} gap={30} size={1.5} color="var(--color-line)" />
		</ReactFlow>
	);
}

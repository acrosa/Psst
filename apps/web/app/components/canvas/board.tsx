import {
	Background,
	BackgroundVariant,
	type Node,
	type NodeChange,
	type NodeTypes,
	ReactFlow,
	ReactFlowProvider,
	applyNodeChanges,
} from '@xyflow/react';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '~/components/ui/confirm-dialog';
import type { Mentionable } from '~/lib/mentions';
import type { BoardItem } from '~/lib/services/canvases.server';
import { DropPasteLayer } from './drop-paste';
import {
	AudioNode,
	type BoardNodeData,
	DrawingNode,
	PostcardNode,
	PrintNode,
	SlipNode,
	StickerNode,
} from './nodes';
import '@xyflow/react/dist/style.css';

const nodeTypes: NodeTypes = {
	link: PostcardNode,
	note: SlipNode,
	emoji: StickerNode,
	image: PrintNode,
	drawing: DrawingNode,
	audio: AudioNode,
};

export type BoardProps = {
	items: BoardItem[];
	currentUserId: string;
	frozen: boolean;
	/** A stranger's view: fronts only — no flipping, no badges. */
	publicView?: boolean;
	/** Space members, for @mentions. */
	members?: Mentionable[];
	onMove?: (itemId: string, x: number, y: number) => void;
	onResize?: (itemId: string, scale: number) => void;
	onDelete?: (itemIds: string[]) => void;
	onLike?: (itemId: string) => void;
	onDraggingChange?: (dragging: boolean) => void;
	/** The composer bar — rendered inside the flow provider so it can place items in view. */
	composer?: React.ReactNode;
};

type BoardNode = Node<BoardNodeData>;

/**
 * The daily canvas: a pannable, zoomable table you lean over together.
 * No edges, no connections — just draggable keepsakes. Server positions win
 * eventually (last-write-wins); the node being dragged and freshly dropped
 * positions are kept locally until the server catches up via polling.
 */
export function Board({
	items,
	currentUserId,
	frozen,
	publicView,
	members,
	onMove,
	onResize,
	onDelete,
	onLike,
	onDraggingChange,
	composer,
}: BoardProps) {
	const draggingId = useRef<string | null>(null);
	const localPos = useRef(new Map<string, { x: number; y: number }>());
	const [deleting, setDeleting] = useState<string[]>([]);

	const toNode = (item: BoardItem): BoardNode => ({
		id: item.id,
		type: item.type,
		position: { x: item.x, y: item.y },
		zIndex: item.z,
		draggable: !frozen,
		data: { item, currentUserId, frozen, publicView, members, onResize, onLike },
	});

	const [nodes, setNodes] = useState<BoardNode[]>(() => items.map(toNode));

	// Merge fresh loader data into the live board without snapping the node
	// being dragged (or one whose PATCH hasn't round-tripped yet).
	// biome-ignore lint/correctness/useExhaustiveDependencies: toNode is stable per render inputs
	useEffect(() => {
		setNodes((prev) => {
			const prevById = new Map(prev.map((node) => [node.id, node]));
			return items.map((item) => {
				const local = localPos.current.get(item.id);
				if (
					local &&
					Math.round(local.x) === Math.round(item.x) &&
					Math.round(local.y) === Math.round(item.y)
				) {
					localPos.current.delete(item.id); // server caught up
				}
				const keepClientPosition = draggingId.current === item.id || localPos.current.has(item.id);
				const prevNode = prevById.get(item.id);
				const node = toNode(item);
				if (keepClientPosition && prevNode) {
					node.position = prevNode.position;
				}
				return node;
			});
		});
	}, [items, currentUserId, frozen, publicView, members]);

	// Delete/Backspace takes the selected cards you authored off the board.
	useEffect(() => {
		if (frozen || !onDelete) return;
		function onKeyDown(event: KeyboardEvent) {
			if (event.key !== 'Delete' && event.key !== 'Backspace') return;
			const target = event.target;
			if (
				target instanceof Element &&
				target.closest('input, textarea, [contenteditable="true"], [contenteditable=""]')
			) {
				return;
			}
			const own = nodes
				.filter((node) => node.selected && node.data.item.authorId === currentUserId)
				.map((node) => node.id);
			if (own.length > 0) {
				event.preventDefault();
				setDeleting(own);
			}
		}
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [frozen, onDelete, nodes, currentUserId]);

	return (
		<div className="psst-board relative h-full w-full">
			<ReactFlowProvider>
				<ReactFlow
					nodes={nodes}
					onNodesChange={(changes: NodeChange<BoardNode>[]) =>
						setNodes((prev) => applyNodeChanges(changes, prev))
					}
					nodeTypes={nodeTypes}
					nodesConnectable={false}
					nodesDraggable={!frozen}
					nodeDragThreshold={4}
					panOnDrag
					zoomOnScroll
					zoomOnDoubleClick={false}
					proOptions={{ hideAttribution: true }}
					minZoom={0.35}
					maxZoom={1.75}
					fitView
					fitViewOptions={{ padding: 0.4, maxZoom: 1 }}
					deleteKeyCode={null}
					onNodeDragStart={(_event, node) => {
						draggingId.current = node.id;
						onDraggingChange?.(true);
					}}
					onNodeDragStop={(_event, node) => {
						draggingId.current = null;
						onDraggingChange?.(false);
						localPos.current.set(node.id, { ...node.position });
						onMove?.(node.id, node.position.x, node.position.y);
					}}
				>
					<Background
						variant={BackgroundVariant.Dots}
						gap={30}
						size={1.5}
						color="var(--color-line)"
					/>
				</ReactFlow>
				{!frozen ? <DropPasteLayer /> : null}
				{composer}
			</ReactFlowProvider>

			<ConfirmDialog
				open={deleting.length > 0}
				onClose={() => setDeleting([])}
				onConfirm={() => onDelete?.(deleting)}
				title={
					deleting.length === 1
						? 'Take this off the board?'
						: `Take ${deleting.length} off the board?`
				}
				message="It leaves the canvas for everyone — quietly, no trace."
				confirmLabel="Take it off"
			/>

			{items.length === 0 ? (
				<div className="pointer-events-none absolute inset-0 grid place-items-center">
					<div className="text-center">
						<p className="font-serif text-2xl text-ink-soft italic">psst — drop something here</p>
						{!frozen ? (
							<p className="mt-1 text-sm text-ink-faint">
								a link, a note, a sticker… anything you'd whisper
							</p>
						) : null}
					</div>
				</div>
			) : null}
		</div>
	);
}

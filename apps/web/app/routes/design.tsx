import { useEffect, useState } from 'react';
import { AppHeader } from '~/components/app-header';
import { AuthCard } from '~/components/auth-card';
import { Board } from '~/components/canvas/board';
import { Composer } from '~/components/canvas/composer';
import { CameraIcon, ChatIcon, PencilIcon, SettingsIcon, SignOutIcon } from '~/components/icons';
import { AuthDivider, SocialButtons } from '~/components/social-buttons';
import { SpaceCard } from '~/components/space-card';
import { AvatarStack } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { env } from '~/lib/env.server';
import type { BoardItem } from '~/lib/services/canvases.server';

export function meta() {
	return [{ title: 'Design — psst' }];
}

/** Internal reference gallery — real screens with sample data. Dev only. */
export async function loader() {
	if (env.NODE_ENV === 'production') {
		throw new Response('Not found', { status: 404 });
	}
	return null;
}

/** Sink for the screens' fetchers (moves, comments, composer) — show, don't store. */
export async function action() {
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const PEOPLE = [
	{ id: 'u1', name: 'Sam', image: null, role: 'owner' as const },
	{ id: 'u2', name: 'Ale', image: null, role: 'member' as const },
	{ id: 'u3', name: 'Mia', image: null, role: 'member' as const },
];

function item(overrides: Partial<BoardItem>): BoardItem {
	return {
		id: 'sample',
		type: 'note',
		url: null,
		text: null,
		x: 0,
		y: 0,
		z: 1,
		rotation: -1.5,
		scale: 1,
		authorId: 'u1',
		authorName: 'Sam',
		createdAt: new Date().toISOString(),
		unfurl: null,
		assets: [],
		comments: [],
		reactions: [],
		...overrides,
	};
}

const BOARD_ITEMS: BoardItem[] = [
	item({
		id: 'i1',
		type: 'link',
		url: 'https://example.com/cabin',
		x: 40,
		y: 30,
		rotation: 1.8,
		unfurl: {
			title: 'A tiny cabin by the lake',
			description: null,
			imageUrl: null,
			faviconUrl: null,
			siteName: 'cabins.example',
			status: 'ok',
		},
	}),
	item({
		id: 'i2',
		text: 'meet you at the lake at six, bring the radio',
		x: 420,
		y: 120,
		rotation: -2.2,
		comments: [
			{
				id: 'c1',
				authorId: 'u2',
				authorName: 'Ale',
				text: 'love this one',
				createdAt: new Date().toISOString(),
			},
		],
		reactions: [
			{ emoji: '🫶', userId: 'u2' },
			{ emoji: '🫶', userId: 'u3' },
		],
	}),
	item({ id: 'i3', type: 'image', x: 760, y: 40, rotation: 2.4, authorName: 'Mia' }),
	item({ id: 'i4', type: 'emoji', text: '🐸', x: 350, y: 420, rotation: 3 }),
	item({
		id: 'i5',
		text: 'someone bring marshmallows',
		x: 700,
		y: 400,
		rotation: 1.2,
		authorName: 'Ale',
		scale: 0.8,
	}),
];

const SPACES = [
	{
		id: 's1',
		name: "Sam's corner",
		emoji: '🌷',
		timezone: 'UTC',
		role: 'owner' as const,
		members: PEOPLE,
		todayCount: 4,
	},
	{
		id: 's2',
		name: 'weekend plans',
		emoji: '🏕️',
		timezone: 'UTC',
		role: 'member' as const,
		members: PEOPLE.slice(0, 2),
		todayCount: 0,
	},
	{
		id: 's3',
		name: 'the group chat refugees',
		emoji: '🫧',
		timezone: 'UTC',
		role: 'member' as const,
		members: PEOPLE.slice(1),
		todayCount: 12,
	},
];

const DAYS = [
	{
		date: 'Monday, August 24',
		count: 6,
		peeks: ['note: the sunset from the roof tonight…', 'emoji:🌇', 'link', 'note: pizza was a 10'],
	},
	{
		date: 'Sunday, August 23',
		count: 3,
		peeks: ['emoji:🥐', 'note: lazy morning, perfect', 'link'],
	},
	{
		date: 'Saturday, August 22',
		count: 9,
		peeks: ['link', 'emoji:🎶', 'emoji:🌊', 'note: beach day!!'],
	},
];

// ---------------------------------------------------------------------------
// Gallery chrome
// ---------------------------------------------------------------------------

function Screen({
	label,
	height = 720,
	children,
}: {
	label: string;
	height?: number;
	children: React.ReactNode;
}) {
	return (
		<section className="space-y-3">
			<h2 className="font-mono font-semibold text-[11px] text-ink-soft uppercase tracking-wider">
				{label}
			</h2>
			<div
				className="relative flex flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-lift"
				style={{ height }}
			>
				{children}
			</div>
		</section>
	);
}

export default function Design() {
	// The board is client-only (pan/zoom/drag) — mount after hydration.
	const [ready, setReady] = useState(false);
	useEffect(() => setReady(true), []);

	return (
		<main className="mx-auto max-w-5xl space-y-16 px-6 py-14">
			<header className="space-y-1">
				<h1 className="font-serif text-3xl">The design system</h1>
				<p className="text-ink-soft text-sm">
					The app's real screens with sample data — live, not mockups. Definitions:{' '}
					<code>docs/DESIGN.md</code>.
				</p>
			</header>

			<Screen label="Sheet — sign in">
				<AuthCard
					title="Welcome back"
					subtitle={
						<>
							New here?{' '}
							<span className="text-accent-deep underline underline-offset-2">
								Make your first canvas
							</span>
						</>
					}
				>
					<div className="grid gap-4">
						<SocialButtons providers={{ google: true, apple: true }} next="/design" />
						<AuthDivider />
					</div>
					<div className="mt-4 grid gap-4">
						<div className="grid gap-1.5">
							<Label htmlFor="ds-email">Email</Label>
							<Input id="ds-email" placeholder="you@example.com" />
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="ds-password">Password</Label>
							<Input id="ds-password" type="password" />
						</div>
						<Button className="w-full">Sign in</Button>
					</div>
				</AuthCard>
			</Screen>

			<Screen label="Shelf — your spaces" height={560}>
				<AppHeader user={{ name: 'Sam', image: null }} />
				<main className="mx-auto w-full max-w-3xl p-6">
					<div className="mb-6 flex items-center justify-between">
						<h1 className="font-serif text-3xl">Your spaces</h1>
						<Button variant="soft">＋ New space</Button>
					</div>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{SPACES.map((space) => (
							<SpaceCard key={space.id} space={space} />
						))}
					</div>
				</main>
			</Screen>

			<Screen label="Canvas — today (drag, flip, react — it's live)">
				<AppHeader user={{ name: 'Sam', image: null }}>
					<div className="flex min-w-0 items-center gap-3">
						<span className="text-2xl" aria-hidden>
							🌷
						</span>
						<div className="min-w-0">
							<div className="truncate font-medium leading-tight">Sam's corner</div>
							<div className="text-ink-faint text-xs leading-tight">
								Today · Wednesday, August 26
							</div>
						</div>
						<Button size="sm">Invite</Button>
						<span className="rounded-lg px-2 py-1.5 text-ink-soft text-sm">Timeline</span>
					</div>
				</AppHeader>
				<div className="relative min-h-0 flex-1">
					{ready ? (
						<Board items={BOARD_ITEMS} currentUserId="u1" frozen={false} composer={<Composer />} />
					) : null}
					<div className="pointer-events-none absolute top-3 right-4 z-10">
						<AvatarStack people={PEOPLE} />
					</div>
				</div>
			</Screen>

			<Screen label="Feedback — progress, loading, whispers" height={330}>
				<div className="relative flex h-full flex-col gap-6 p-8">
					{/* the navigation progress bar, looping for demo */}
					<div
						className="nav-progress"
						style={{ position: 'absolute', animationIterationCount: 'infinite' }}
					/>
					<p className="text-ink-soft text-sm">
						The top-edge bar sweeps while a page loads. Below: the waiting vocabulary.
					</p>
					<span className="animate-shimmer font-serif text-ink-soft text-xl italic">
						setting the table…
					</span>
					<div className="flex items-center gap-4">
						<span className="animate-shimmer rounded-full bg-card px-3 py-1.5 font-serif text-lg text-ink-soft italic shadow-card">
							tucking it in — 2 to go
						</span>
						<span className="rounded-lg bg-accent-soft px-3 py-1.5 text-accent-deep text-sm shadow-card">
							a friendly error, in the tinted wash
						</span>
					</div>
					<div className="grid h-24 w-72 place-items-center rounded-xl border-2 border-accent border-dashed bg-card/50">
						<p className="font-serif text-ink-soft text-xl italic">drop it on the board</p>
					</div>
				</div>
			</Screen>

			<Screen label="Details — menus, dialogs, the pencil" height={420}>
				<div className="flex h-full flex-wrap items-start gap-10 p-8">
					{/* account menu, open (static replica) */}
					<div className="w-52 rounded-lg border border-line bg-card p-1 shadow-lift">
						<span className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition hover:bg-paper-deep">
							<CameraIcon className="h-4 w-4 text-ink-soft" />
							Change photo
						</span>
						<span className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition hover:bg-paper-deep">
							<SettingsIcon className="h-4 w-4 text-ink-soft" />
							Space settings
						</span>
						<div className="mx-2 my-1 h-px bg-line" />
						<span className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition hover:bg-paper-deep">
							<SignOutIcon className="h-4 w-4 text-ink-soft" />
							Sign out
						</span>
					</div>

					{/* confirm dialog (static replica) */}
					<div className="w-[min(24rem,100%)] rounded-xl border border-line bg-card p-5 shadow-lift">
						<h3 className="mb-3 font-serif text-2xl">Take this off the board?</h3>
						<p className="text-ink-soft text-sm">
							It leaves the canvas for everyone — quietly, no trace.
						</p>
						<div className="mt-5 flex justify-end gap-2">
							<Button variant="ghost">Keep it</Button>
							<Button>Take it off</Button>
						</div>
					</div>

					{/* draw toolbar (static replica) */}
					<div className="flex w-full max-w-xl items-center gap-2 rounded-full border border-line bg-card px-3 py-2 shadow-lift">
						<span className="flex items-center gap-1.5">
							{['#e2725b', '#4a7dbd', '#4e9a58', '#e0b64a', '#8b6cc1', '#6a5f4e'].map(
								(color, index) => (
									<span
										key={color}
										style={{ backgroundColor: color }}
										className={
											index === 1
												? 'h-6 w-6 rounded-full ring-2 ring-ink/40 ring-offset-2 ring-offset-card'
												: 'h-6 w-6 rounded-full'
										}
									/>
								),
							)}
						</span>
						<span className="flex-1 text-center font-serif text-ink-soft text-sm italic">
							draw — pause and it settles onto the board
						</span>
						<span className="grid h-9 w-9 place-items-center rounded-full text-ink-soft">
							<PencilIcon className="h-[18px] w-[18px]" />
						</span>
					</div>

					{/* caption badges (static replica) */}
					<div className="flex items-center gap-1.5">
						<span className="flex items-center gap-1.5 rounded-lg bg-card/90 px-2 py-1.5 font-semibold text-ink-soft text-xs shadow-card">
							<ChatIcon className="h-3.5 w-3.5" />2
						</span>
						<span className="flex items-center gap-1 rounded-lg bg-card/90 px-2 py-1.5 text-xs shadow-card">
							🫶 <span className="font-semibold text-ink-soft">2</span>
						</span>
					</div>
				</div>
			</Screen>

			<Screen label="Shelf — the scrapbook" height={640}>
				<AppHeader user={{ name: 'Sam', image: null }}>
					<span className="text-ink-soft text-sm">← back to today · 🌷 Sam's corner</span>
				</AppHeader>
				<main className="mx-auto w-full max-w-2xl overflow-y-auto p-6">
					<h1 className="font-serif text-3xl">The scrapbook</h1>
					<p className="mt-1 text-ink-soft text-sm">Every day archives itself as you left it.</p>
					<ul className="mt-6 grid gap-4">
						{DAYS.map((day) => (
							<li key={day.date}>
								<div className="group flex flex-col gap-3 rounded-xl border border-line bg-card p-5 shadow-card transition hover:-rotate-[0.5deg] hover:shadow-lift">
									<div className="flex items-baseline justify-between gap-3">
										<span className="font-medium">{day.date}</span>
										<span className="rounded-full bg-paper-deep px-2.5 py-1 text-ink-soft text-xs">
											{day.count} things
										</span>
									</div>
									<div className="flex flex-wrap items-center gap-2">
										{day.peeks.map((peek) =>
											peek.startsWith('note: ') ? (
												<span
													key={peek}
													className="line-clamp-2 max-w-24 rounded-sm bg-butter px-1.5 py-1 font-serif text-sm leading-tight"
												>
													{peek.slice(6)}
												</span>
											) : peek.startsWith('emoji:') ? (
												<span key={peek} className="text-2xl">
													{peek.slice(6)}
												</span>
											) : (
												<span
													key={peek}
													className="grid h-12 w-12 place-items-center rounded-sm bg-sky text-lg"
												>
													📮
												</span>
											),
										)}
									</div>
								</div>
							</li>
						))}
					</ul>
				</main>
			</Screen>
		</main>
	);
}

import { Link, redirect } from 'react-router';
import { Daylight } from '~/components/daylight';
import { ArrowUpRightIcon, LinkIcon, PlayIcon } from '~/components/icons';
import { getUser } from '~/lib/auth.server';
import { ogMeta } from '~/lib/og';
import { stickerCut, tornEdge } from '~/lib/paper';
import type { Route } from './+types/home2';

export function meta() {
	return [
		{ title: 'psst' },
		...ogMeta({
			title: 'psst',
			description: 'A private space for the things you like.',
		}),
	];
}

export async function loader({ request }: Route.LoaderArgs) {
	const user = await getUser(request);
	if (user) {
		throw redirect('/spaces');
	}
	return null;
}

/**
 * The wall. A terracotta surface in morning light, with the things a small
 * group keeps pinned to it: a kraft card, a couple of stickers, an invite,
 * a clip, a scrap, a heart. The light and the leaf shadows are the Daylight
 * shader laid over everything; the objects are plain DOM, each with the
 * same shadow from the same sun.
 *
 * One stage scales with the viewport (container units via `--u`): a 16:9
 * wall on wide screens, a 9:16 one held closer on phones.
 */
const CSS = `
.home2 {
	--wall: #c8653d;
	--kraft: #e8d6bc;
	--kraft-light: #ecdfca;
	--white: #f4eee4;
	--terra: #b2582f;
	--ink: #4a423a;
	--u: 3cqw;
}
:root.dark .home2 {
	--wall: #5a2c1c;
	--kraft: #cdb999;
	--kraft-light: #d3c2a8;
	--white: #e6dccc;
	--terra: #8f4322;
	--ink: #3b342d;
}
@media (min-width: 640px) {
	.home2 { --u: 1cqw; }
}
/* Everything on the wall throws the same shadow, from the same sun. */
.h2-shadow {
	box-shadow:
		calc(var(--u) * 0.3) calc(var(--u) * 0.9) calc(var(--u) * 2) rgb(70 25 8 / 0.38),
		calc(var(--u) * 0.08) calc(var(--u) * 0.25) calc(var(--u) * 0.5) rgb(70 25 8 / 0.22);
}
.h2-cut {
	filter: drop-shadow(calc(var(--u) * 0.3) calc(var(--u) * 0.8) calc(var(--u) * 1) rgb(70 25 8 / 0.4));
}
/* Kraft grain. */
.h2-grain {
	background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.3 0 0 0 0 0.22 0 0 0 0 0.15 0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");
	opacity: 0.22;
	mix-blend-mode: multiply;
}
/* The sticker's lifted corner. */
.h2-peel {
	border-radius: 100% 0 100% 0;
	background: linear-gradient(135deg, #fbf8f2 0%, #e9e1d3 55%, #cfc4b1 100%);
	box-shadow: calc(var(--u) * -0.25) calc(var(--u) * -0.25) calc(var(--u) * 0.6) rgb(70 25 8 / 0.28);
}
`;

const HEART =
	'M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88 Z';

export default function Home2() {
	return (
		<div className="home2 relative min-h-svh overflow-hidden bg-[var(--wall)]">
			<style>{CSS}</style>

			<main className="relative z-10 flex min-h-svh items-center justify-center">
				<div className="@container relative aspect-[9/16] w-full max-w-[calc(100svh*9/16)] sm:aspect-[16/9] sm:max-w-[calc(100svh*16/9)]">
					{/* The card */}
					<section className="h2-shadow absolute top-[18%] left-[8%] aspect-[4/5] w-[84%] rotate-[-0.6deg] bg-[var(--kraft)] sm:top-[13%] sm:left-[27.7%] sm:aspect-square sm:w-[44.3%]">
						<div className="h2-grain absolute inset-0" aria-hidden />
						<div className="absolute inset-0 flex flex-col items-center justify-center gap-[calc(var(--u)*2.2)] px-[calc(var(--u)*3)] text-center text-[var(--terra)]">
							<h1 className="font-serif text-[calc(var(--u)*2.5)] leading-[1.12] sm:text-[calc(var(--u)*2.9)]">
								A private space for
								<br />
								the things you like.
							</h1>
							<p className="max-w-[calc(var(--u)*30)] text-[calc(var(--u)*1.2)] leading-snug opacity-90 sm:text-[calc(var(--u)*1.3)]">
								One canvas a day for you and a few friends. Drop links, notes, photos and stickers —
								tomorrow it becomes a page in your scrapbook.
							</p>
							<div className="mt-[calc(var(--u)*1)] flex items-center justify-center gap-[calc(var(--u)*2)]">
								<Link
									to="/register"
									className="rounded-full bg-[var(--terra)] px-[calc(var(--u)*2.4)] py-[calc(var(--u)*1.1)] font-medium text-[calc(var(--u)*1.35)] text-[var(--kraft)] transition hover:brightness-95"
								>
									Start a canvas
								</Link>
								<Link
									to="/login"
									className="font-medium text-[calc(var(--u)*1.35)] text-[var(--terra)] transition hover:opacity-80"
								>
									Sign in
								</Link>
							</div>
						</div>
					</section>

					{/* Round sticker */}
					<div className="absolute top-[6%] left-[5%] aspect-square w-[30%] rotate-[-6deg] sm:top-[11%] sm:left-[7.4%] sm:w-[14%]">
						<div className="h2-shadow absolute inset-0 rounded-full bg-[var(--white)]" />
						<span className="absolute inset-0 grid place-items-center font-serif text-[calc(var(--u)*3.7)] text-[var(--terra)] italic leading-none">
							psst.
						</span>
						<div className="h2-peel absolute right-[5%] bottom-[3%] h-[32%] w-[32%]" aria-hidden />
					</div>

					{/* Emoji sticker */}
					<div className="absolute top-[9%] left-[66%] aspect-square w-[24%] rotate-[4deg] sm:top-[43%] sm:left-[7%] sm:w-[10.5%]">
						<svg
							viewBox="0 0 100 100"
							className="h2-cut absolute inset-0 h-full w-full"
							aria-hidden="true"
						>
							<path d={stickerCut('home2-smile')} fill="var(--white)" />
						</svg>
						<span className="absolute inset-0 grid place-items-center text-[calc(var(--u)*6.4)] leading-none">
							😊
						</span>
					</div>

					{/* Invite link */}
					<div className="h2-shadow absolute top-[86%] left-[3%] flex w-[64%] rotate-[-9deg] items-center gap-[calc(var(--u)*0.9)] rounded-[calc(var(--u)*1.1)] bg-[var(--kraft-light)] px-[calc(var(--u)*1.4)] py-[calc(var(--u)*1.5)] text-[calc(var(--u)*1.1)] text-[var(--ink)] sm:top-[68%] sm:left-[5.5%] sm:w-[27%] sm:text-[calc(var(--u)*1.2)]">
						<LinkIcon
							className="h-[calc(var(--u)*1.4)] w-[calc(var(--u)*1.4)] shrink-0"
							strokeWidth={2.2}
						/>
						<span className="flex-1 truncate">psst.app/invite/olivia</span>
						<ArrowUpRightIcon
							className="h-[calc(var(--u)*1.5)] w-[calc(var(--u)*1.5)] shrink-0"
							strokeWidth={2.2}
						/>
					</div>

					{/* Morning light, a clip */}
					<figure className="h2-shadow absolute top-[18%] left-[75%] hidden w-[20.5%] rotate-[3deg] rounded-[calc(var(--u)*0.9)] bg-[var(--white)] p-[calc(var(--u)*0.8)] pb-[calc(var(--u)*1)] sm:block">
						<div className="relative aspect-[4/5] overflow-hidden rounded-[calc(var(--u)*0.5)] bg-[linear-gradient(100deg,#b8603c_0%,#c46d47_50%,#d9c3a7_50.5%,#e3d2ba_100%)]">
							<div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_18%,rgb(255_235_205/0.35)_30%,transparent_46%,rgb(70_25_8/0.18)_60%,transparent_74%)]" />
							<PlayIcon
								className="absolute top-1/2 left-1/2 h-[calc(var(--u)*2)] w-[calc(var(--u)*2)] -translate-x-1/2 -translate-y-1/2 fill-[var(--white)] text-[var(--white)] opacity-90"
								strokeWidth={1}
							/>
							<div className="absolute right-[7%] bottom-[9%] left-[7%] h-[calc(var(--u)*0.22)] rounded-full bg-[rgb(255_250_240/0.45)]">
								<div className="h-full w-[62%] rounded-full bg-[var(--white)]" />
								<div className="-translate-y-1/2 absolute top-1/2 left-[62%] h-[calc(var(--u)*0.6)] w-[calc(var(--u)*0.6)] -translate-x-1/2 rounded-full bg-[var(--white)]" />
							</div>
						</div>
						<figcaption className="mt-[calc(var(--u)*0.9)] text-[calc(var(--u)*1.05)] text-[var(--ink)] leading-snug">
							Morning light
							<br />
							<span className="font-mono text-[calc(var(--u)*0.9)] opacity-80">0:12</span>
						</figcaption>
					</figure>

					{/* A scrap */}
					<div className="absolute top-[68%] left-[60%] aspect-[300/260] w-[40%] rotate-[4deg] sm:top-[68%] sm:left-[75.5%] sm:w-[18.5%]">
						<svg
							viewBox="0 0 300 260"
							className="h2-cut absolute inset-0 h-full w-full"
							aria-hidden="true"
						>
							<path d={tornEdge('home2-scrap', 300, 260)} fill="var(--kraft-light)" />
						</svg>
						<span className="absolute inset-0 grid place-items-center font-serif text-[calc(var(--u)*3.4)] text-[var(--terra)] italic leading-none">
							psst.
						</span>
					</div>

					{/* A heart */}
					<svg
						viewBox="0 0 100 100"
						className="h2-cut absolute top-[87%] left-[42%] aspect-square w-[20%] rotate-[-12deg] sm:top-[80%] sm:left-[69.5%] sm:w-[10.5%]"
						aria-hidden="true"
					>
						<path
							d={HEART}
							fill="none"
							stroke="var(--white)"
							strokeWidth={11}
							strokeLinejoin="round"
						/>
					</svg>
				</div>
			</main>

			<p className="absolute bottom-4 left-5 z-10 text-[var(--kraft)] text-xs opacity-70">
				<Link to="/privacy" className="transition hover:opacity-100">
					Privacy
				</Link>
				{' · '}
				<Link to="/terms" className="transition hover:opacity-100">
					Terms
				</Link>
			</p>

			{/* The light, over everything */}
			<div className="pointer-events-none fixed inset-0 z-20 mix-blend-overlay">
				<Daylight />
			</div>
		</div>
	);
}

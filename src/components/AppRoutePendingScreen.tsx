/**
 * Full-screen route pending UI — used as `defaultPendingComponent`.
 * Animations suggest indeterminate progress; not tied to real load %.
 */
export function AppRoutePendingScreen() {
	return (
		<>
			<style>{`
				.arp {
					--arp-lagoon: var(--lagoon);
					--arp-lagoon-dim: color-mix(in oklab, var(--lagoon) 45%, transparent);
					--arp-palm: color-mix(in oklab, var(--palm) 70%, var(--lagoon));
					min-height: 100dvh;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					position: relative;
					isolation: isolate;
					padding: 2rem 1.5rem;
					overflow: hidden;
				}

				.arp__wash {
					position: absolute;
					inset: -40%;
					z-index: 0;
					background:
						conic-gradient(
							from 220deg at 50% 50%,
							color-mix(in oklab, var(--hero-a) 55%, transparent),
							color-mix(in oklab, var(--hero-b) 50%, transparent),
							color-mix(in oklab, var(--lagoon) 22%, transparent),
							color-mix(in oklab, var(--palm) 18%, transparent),
							color-mix(in oklab, var(--hero-a) 55%, transparent)
						);
					animation: arp-spin 22s linear infinite;
					opacity: 0.55;
					filter: blur(72px);
				}

				.arp__grid {
					position: absolute;
					inset: 0;
					z-index: 1;
					background-image:
						linear-gradient(
							105deg,
							transparent 0%,
							color-mix(in oklab, var(--lagoon) 12%, transparent) 48%,
							transparent 96%
						),
						repeating-linear-gradient(
							-12deg,
							transparent,
							transparent 11px,
							color-mix(in oklab, var(--line) 35%, transparent) 11px,
							color-mix(in oklab, var(--line) 35%, transparent) 12px
						);
					background-size: 200% 200%, auto;
					animation: arp-grid-drift 14s ease-in-out infinite;
					mask-image: radial-gradient(ellipse 70% 55% at 50% 48%, black 20%, transparent 72%);
					pointer-events: none;
					opacity: 0.45;
				}

				.arp__rings {
					position: relative;
					z-index: 2;
					width: min(320px, 72vw);
					aspect-ratio: 1;
					margin-bottom: 2.25rem;
				}

				.arp__ring {
					position: absolute;
					inset: 0;
					border-radius: 50%;
					border: 1.5px solid transparent;
					border-top-color: var(--arp-lagoon);
					border-right-color: color-mix(in oklab, var(--arp-palm) 55%, transparent);
					opacity: 0;
					animation: arp-ring-out 2.8s cubic-bezier(0.22, 1, 0.36, 1) infinite;
				}

				.arp__ring:nth-child(1) { animation-delay: 0s; }
				.arp__ring:nth-child(2) { animation-delay: 0.55s; }
				.arp__ring:nth-child(3) { animation-delay: 1.1s; }

				.arp__core {
					position: absolute;
					inset: 22%;
					border-radius: 50%;
					background: linear-gradient(
						145deg,
						color-mix(in oklab, var(--surface-strong) 88%, var(--lagoon) 12%),
						color-mix(in oklab, var(--foam) 70%, transparent)
					);
					box-shadow:
						0 0 0 1px color-mix(in oklab, var(--line) 80%, transparent) inset,
						0 18px 48px color-mix(in oklab, var(--sea-ink) 12%, transparent),
						0 0 80px color-mix(in oklab, var(--lagoon) 18%, transparent);
					animation: arp-core-breathe 2.2s ease-in-out infinite;
				}

				.arp__core::after {
					content: '';
					position: absolute;
					inset: 12%;
					border-radius: inherit;
					background: linear-gradient(
						110deg,
						transparent 0%,
						color-mix(in oklab, white 55%, transparent) 42%,
						transparent 64%
					);
					animation: arp-shimmer 1.9s ease-in-out infinite;
					opacity: 0.85;
				}

				.arp__orbit {
					position: absolute;
					inset: 8%;
					border-radius: 50%;
					border: 1px dashed color-mix(in oklab, var(--sea-ink-soft) 35%, transparent);
					animation: arp-orbit 9s linear infinite;
				}

				.arp__orbit span {
					position: absolute;
					width: 9px;
					height: 9px;
					top: 0;
					left: 50%;
					margin-left: -4.5px;
					margin-top: -4px;
					border-radius: 50%;
					background: radial-gradient(circle at 30% 30%, white, var(--arp-lagoon));
					box-shadow: 0 0 14px color-mix(in oklab, var(--lagoon) 55%, transparent);
					animation: arp-dot-pulse 1.4s ease-in-out infinite;
				}

				.arp__orbit span:nth-child(2) {
					top: 50%;
					left: auto;
					right: 0;
					margin: -4.5px -4px 0 0;
					animation-delay: 0.35s;
					background: radial-gradient(circle at 30% 30%, white, var(--arp-palm));
				}

				.arp__orbit span:nth-child(3) {
					top: auto;
					bottom: 0;
					left: 50%;
					margin: 0 0 -4px -4.5px;
					animation-delay: 0.7s;
				}

				.arp__orbit span:nth-child(4) {
					top: 50%;
					left: 0;
					margin: -4.5px 0 0 -4px;
					animation-delay: 1.05s;
				}

				.arp__caption {
					position: relative;
					z-index: 2;
					text-align: center;
					max-width: 20rem;
				}

				.arp__title {
					font-family: 'Fraunces', Georgia, serif;
					font-size: clamp(1.35rem, 3.5vw, 1.75rem);
					font-weight: 500;
					color: var(--sea-ink);
					letter-spacing: -0.02em;
					margin: 0 0 0.5rem;
					animation: arp-title-soft 3.6s ease-in-out infinite;
				}

				.arp__sub {
					margin: 0;
					font-size: 0.8125rem;
					font-weight: 500;
					letter-spacing: 0.08em;
					text-transform: uppercase;
					color: color-mix(in oklab, var(--sea-ink-soft) 88%, var(--lagoon));
				}

				.arp__bars {
					display: flex;
					gap: 6px;
					justify-content: center;
					margin-top: 1.75rem;
				}

				.arp__bars span {
					display: block;
					width: 4px;
					height: 22px;
					border-radius: 99px;
					background: linear-gradient(
						180deg,
						var(--arp-lagoon-dim),
						var(--arp-lagoon)
					);
					transform-origin: center bottom;
					animation: arp-bar-wave 1.05s ease-in-out infinite;
					opacity: 0.35;
				}

				.arp__bars span:nth-child(1) { animation-delay: 0ms; }
				.arp__bars span:nth-child(2) { animation-delay: 80ms; }
				.arp__bars span:nth-child(3) { animation-delay: 160ms; }
				.arp__bars span:nth-child(4) { animation-delay: 240ms; }
				.arp__bars span:nth-child(5) { animation-delay: 320ms; }
				.arp__bars span:nth-child(6) { animation-delay: 400ms; }
				.arp__bars span:nth-child(7) { animation-delay: 480ms; }

				@keyframes arp-spin {
					to { transform: rotate(360deg); }
				}

				@keyframes arp-grid-drift {
					0%, 100% { background-position: 0% 40%, 0 0; }
					50% { background-position: 100% 60%, 8px 4px; }
				}

				@keyframes arp-ring-out {
					0% {
						transform: scale(0.35) rotate(-95deg);
						opacity: 0;
					}
					12% { opacity: 0.85; }
					100% {
						transform: scale(1.08) rotate(85deg);
						opacity: 0;
					}
				}

				@keyframes arp-core-breathe {
					0%, 100% { transform: scale(1); }
					50% { transform: scale(1.04); }
				}

				@keyframes arp-shimmer {
					0%, 100% { transform: translateX(-35%) rotate(0deg); opacity: 0.35; }
					50% { transform: translateX(35%) rotate(0deg); opacity: 0.95; }
				}

				@keyframes arp-orbit {
					to { transform: rotate(360deg); }
				}

				@keyframes arp-dot-pulse {
					0%, 100% { transform: scale(0.85); opacity: 0.65; }
					50% { transform: scale(1.15); opacity: 1; }
				}

				@keyframes arp-title-soft {
					0%, 100% { opacity: 1; }
					50% { opacity: 0.82; }
				}

				@keyframes arp-bar-wave {
					0%, 100% {
						transform: scaleY(0.35);
						opacity: 0.3;
					}
					50% {
						transform: scaleY(1);
						opacity: 1;
					}
				}

				@media (prefers-reduced-motion: reduce) {
					.arp__wash,
					.arp__grid,
					.arp__ring,
					.arp__core,
					.arp__core::after,
					.arp__orbit,
					.arp__orbit span,
					.arp__title,
					.arp__bars span {
						animation: none !important;
					}
					.arp__ring {
						opacity: 0.35;
						transform: scale(0.72) rotate(12deg);
					}
					.arp__orbit {
						transform: none;
					}
					.arp__wash {
						opacity: 0.35;
					}
				}
			`}</style>

			<div aria-busy="true" aria-live="polite" className="arp" role="status">
				<span className="sr-only">Loading mortgage workspace</span>
				<div aria-hidden className="arp__wash" />
				<div aria-hidden className="arp__grid" />

				<div aria-hidden className="arp__rings">
					<div className="arp__ring" />
					<div className="arp__ring" />
					<div className="arp__ring" />
					<div className="arp__core" />
					<div className="arp__orbit">
						<span />
						<span />
						<span />
						<span />
					</div>
				</div>

				<div className="arp__caption">
					<p className="arp__title">Preparing your mortgage workspace</p>
					<p className="arp__sub">Loan records · pipeline · access</p>
					<div aria-hidden className="arp__bars">
						<span />
						<span />
						<span />
						<span />
						<span />
						<span />
						<span />
					</div>
				</div>
			</div>
		</>
	);
}

import { AlertTriangle } from "lucide-react";
import { CompleteScreen } from "./CompleteScreen";
import { DealPortalStepRail } from "./DealPortalStepRail";
import { DocumentsScreen } from "./DocumentsScreen";
import { formatEnumLabel, formatPercent, shortDealId } from "./format";
import { PaymentScreen } from "./PaymentScreen";
import { RepresentationScreen } from "./RepresentationScreen";
import type { DealPortalWorkspace } from "./types";

function renderActiveDealPortalContent(workspace: DealPortalWorkspace) {
	return (
		<>
			{workspace.activeScreen === "representation" ? (
				<RepresentationScreen workspace={workspace} />
			) : null}
			{workspace.activeScreen === "documents" ? (
				<DocumentsScreen workspace={workspace} />
			) : null}
			{workspace.activeScreen === "payment" ? (
				<PaymentScreen workspace={workspace} />
			) : null}
			{workspace.activeScreen === "complete" ||
			workspace.activeScreen === "failed" ? (
				<CompleteScreen workspace={workspace} />
			) : null}
		</>
	);
}

function OnboardingRequiredPanel({
	workspace,
}: {
	workspace: DealPortalWorkspace;
}) {
	return (
		<section className="island-shell rounded-xl p-6">
			<h2 className="font-semibold text-xl" style={{ color: "var(--sea-ink)" }}>
				Complete legal onboarding
			</h2>
			<p
				className="mt-2 text-sm leading-6"
				style={{ color: "var(--sea-ink-soft)" }}
			>
				Finish identity, LSO, and representation checks before this deal can
				show lawyer actions.
			</p>
			{workspace.onboarding.nextRoute ? (
				<a
					className="mt-4 inline-flex rounded-lg px-4 py-2.5 font-medium text-sm text-white transition-all hover:opacity-90"
					href={workspace.onboarding.nextRoute}
					style={{ background: "var(--sea-ink)" }}
				>
					Continue onboarding
				</a>
			) : null}
		</section>
	);
}

const roleColorMap: Record<string, { bg: string; text: string }> = {
	primary_borrower: {
		bg: "color-mix(in oklab, var(--lagoon) 15%, white)",
		text: "var(--lagoon-deep)",
	},
	broker_of_record: {
		bg: "color-mix(in oklab, var(--sea-ink-soft) 15%, white)",
		text: "var(--sea-ink)",
	},
	purchasing_lender: {
		bg: "color-mix(in oklab, var(--palm) 12%, white)",
		text: "var(--palm)",
	},
	selling_lender: {
		bg: "color-mix(in oklab, var(--palm) 12%, white)",
		text: "var(--palm)",
	},
	primary_lawyer: {
		bg: "color-mix(in oklab, var(--lagoon) 12%, white)",
		text: "var(--lagoon-deep)",
	},
};

function getRoleColor(role: string) {
	return (
		roleColorMap[role] ?? {
			bg: "color-mix(in oklab, var(--sea-ink-soft) 10%, white)",
			text: "var(--sea-ink-soft)",
		}
	);
}

const NAME_SPLIT_RE = /\s+/;

function initials(name: string | null) {
	if (!name) {
		return "?";
	}
	const parts = name.trim().split(NAME_SPLIT_RE);
	if (parts.length === 1) {
		return parts[0].slice(0, 2).toUpperCase();
	}
	return (parts[0][0] + (parts.at(-1)?.[0] ?? "")).toUpperCase();
}

function ClosingAssembly({
	parties,
}: {
	readonly parties: DealPortalWorkspace["participants"]["involvedParties"];
}) {
	return (
		<div className="py-2">
			<div className="flex flex-wrap items-start justify-center gap-x-2 gap-y-6">
				{parties.map((party, index) => {
					const colors = getRoleColor(party.role);
					const isLast = index === parties.length - 1;
					return (
						<div className="flex items-start gap-2" key={party.role}>
							<div className="flex flex-col items-center gap-2">
								<div className="relative">
									<div
										className="flex size-14 items-center justify-center rounded-full font-bold text-sm tracking-wide"
										style={{
											background: colors.bg,
											color: colors.text,
											boxShadow: "0 2px 8px rgba(23,58,64,0.08)",
										}}
									>
										{initials(party.name)}
									</div>
									{party.hasWorkspaceAccess ? (
										<div
											aria-label="Signatory"
											className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full border-2"
											role="img"
											style={{
												background: "var(--palm)",
												borderColor: "var(--bg-base)",
											}}
										>
											<svg
												className="size-3 text-white"
												fill="none"
												stroke="currentColor"
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={3}
												viewBox="0 0 24 24"
											>
												<title>Signatory</title>
												<path d="M5 13l4 4L19 7" />
											</svg>
										</div>
									) : null}
								</div>
								<p
									className="max-w-[7rem] truncate text-center font-semibold text-sm"
									style={{ color: "var(--sea-ink)" }}
								>
									{party.name ?? "Not assigned"}
								</p>
								<p
									className="max-w-[7rem] truncate text-center font-semibold text-xs uppercase tracking-widest"
									style={{ color: "var(--sea-ink-soft)" }}
								>
									{party.label}
								</p>
							</div>
							{isLast ? null : (
								<div
									className="mt-6 hidden h-px w-6 sm:block"
									style={{ background: "var(--line)" }}
								/>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

export function DealPortalShell({
	workspace,
}: {
	readonly workspace: DealPortalWorkspace;
}) {
	const onboardingOnly = workspace.onboarding.required;
	return (
		<main className="min-h-dvh text-slate-950">
			<div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8">
				<div className="min-w-0 space-y-8">
					{/* Header */}
					<header className="flex flex-wrap items-end justify-between gap-4">
						<div>
							<p className="island-kicker">Deal Portal</p>
							<h1
								className="display-title mt-1 text-3xl tracking-tight"
								style={{ color: "var(--sea-ink)" }}
							>
								Deal {shortDealId(String(workspace.deal.dealId))}
							</h1>
							<p
								className="mt-1 text-sm"
								style={{ color: "var(--sea-ink-soft)" }}
							>
								{onboardingOnly
									? "Legal onboarding required"
									: `${formatEnumLabel(workspace.viewer.persona)} view · ${formatEnumLabel(workspace.deal.status)}`}
							</p>
						</div>

						{onboardingOnly ? null : (
							<div className="flex flex-col items-end gap-0.5">
								<p
									className="font-semibold text-xs uppercase tracking-widest"
									style={{ color: "var(--sea-ink-soft)" }}
								>
									Share
								</p>
								<p
									className="font-semibold text-2xl"
									style={{ color: "var(--sea-ink)" }}
								>
									{formatPercent(workspace.deal.fractionalShareDisplayPercent)}
								</p>
							</div>
						)}
					</header>

					{onboardingOnly ? null : (
						<DealPortalStepRail
							activeScreen={workspace.activeScreen}
							dealStatus={workspace.deal.status}
						/>
					)}

					{onboardingOnly ? (
						<OnboardingRequiredPanel workspace={workspace} />
					) : (
						<>
							{/* Parties — The Closing Assembly */}
							<section className="island-shell rounded-xl p-6">
								<div className="mb-1 text-center">
									<h2 className="island-kicker">Closing Assembly</h2>
									<p
										className="mt-1 text-xs"
										style={{ color: "var(--sea-ink-soft)" }}
									>
										Participants and their closing roles
									</p>
								</div>
								<ClosingAssembly
									parties={workspace.participants.involvedParties}
								/>
							</section>

							{/* Blockers */}
							{workspace.blockers.length > 0 ? (
								<div className="space-y-2">
									{workspace.blockers.map((blocker) => (
										<div
											className="flex items-start gap-3 rounded-xl p-4"
											key={`${blocker.code}:${blocker.message}`}
											style={{
												background:
													"color-mix(in oklab, var(--sand) 60%, #fef3c7)",
												border:
													"1px solid color-mix(in oklab, var(--line) 50%, #fcd34d)",
											}}
										>
											<AlertTriangle
												className="mt-0.5 size-4 shrink-0"
												style={{ color: "#b45309" }}
											/>
											<div>
												<p
													className="font-semibold text-sm"
													style={{ color: "#78350f" }}
												>
													{formatEnumLabel(blocker.code)}
												</p>
												<p
													className="mt-0.5 text-sm leading-relaxed"
													style={{ color: "#92400e" }}
												>
													{blocker.message}
												</p>
											</div>
										</div>
									))}
								</div>
							) : null}

							{renderActiveDealPortalContent(workspace)}
						</>
					)}
				</div>
			</div>
		</main>
	);
}

import { AlertTriangle, UserRound } from "lucide-react";
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

export function DealPortalShell({
	workspace,
}: {
	readonly workspace: DealPortalWorkspace;
}) {
	return (
		<main className="min-h-dvh bg-slate-50 text-slate-950">
			<div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:px-8">
				<DealPortalStepRail
					activeScreen={workspace.activeScreen}
					dealStatus={workspace.deal.status}
				/>
				<section className="min-w-0 space-y-5">
					<header className="border-slate-200 border-b pb-4">
						<p className="font-medium text-slate-500 text-xs uppercase tracking-[0.14em]">
							Deal portal
						</p>
						<div className="mt-2 flex flex-wrap items-end justify-between gap-3">
							<div>
								<h1 className="font-semibold text-2xl tracking-tight">
									Deal {shortDealId(String(workspace.deal.dealId))}
								</h1>
								<p className="mt-1 text-slate-600 text-sm">
									{formatEnumLabel(workspace.viewer.persona)} view ·{" "}
									{formatEnumLabel(workspace.deal.status)}
								</p>
							</div>
							<div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-right">
								<p className="text-slate-500 text-xs">Share</p>
								<p className="font-medium text-sm">
									{formatPercent(workspace.deal.fractionalShareDisplayPercent)}
								</p>
							</div>
						</div>
					</header>

					<section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
						<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
							<div>
								<h2 className="font-semibold text-lg">Parties</h2>
								<p className="mt-1 text-slate-600 text-sm">
									Deal participants and their closing roles.
								</p>
							</div>
						</div>
						<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
							{workspace.participants.involvedParties.map((party) => (
								<div
									className="rounded-md border border-slate-200 bg-slate-50 p-3"
									key={party.role}
								>
									<div className="flex items-start gap-3">
										<div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600">
											<UserRound className="size-4" />
										</div>
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-center gap-2">
												<p className="font-medium text-slate-500 text-xs uppercase tracking-[0.12em]">
													{party.label}
												</p>
												{party.hasWorkspaceAccess ? (
													<span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-[0.65rem] text-emerald-700 uppercase tracking-[0.1em]">
														Signatory
													</span>
												) : null}
											</div>
											<p className="mt-1 truncate font-medium text-slate-950 text-sm">
												{party.name ?? "Not assigned"}
											</p>
											<p className="mt-0.5 truncate text-slate-500 text-xs">
												{party.email ?? "No email on file"}
											</p>
										</div>
									</div>
								</div>
							))}
						</div>
					</section>

					{workspace.blockers.length > 0 ? (
						<div className="grid gap-2">
							{workspace.blockers.map((blocker) => (
								<div
									className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950"
									key={`${blocker.code}:${blocker.message}`}
								>
									<AlertTriangle className="mt-0.5 size-4 text-amber-700" />
									<div>
										<p className="font-medium text-sm">
											{formatEnumLabel(blocker.code)}
										</p>
										<p className="text-sm leading-6">{blocker.message}</p>
									</div>
								</div>
							))}
						</div>
					) : null}

					{workspace.onboarding.required ? (
						<section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
							<h2 className="font-semibold text-xl">
								Complete legal onboarding
							</h2>
							<p className="mt-2 text-slate-600 text-sm leading-6">
								Finish identity, LSO, and representation checks before this deal
								can show lawyer actions.
							</p>
							{workspace.onboarding.nextRoute ? (
								<a
									className="mt-4 inline-flex rounded-md bg-slate-950 px-3 py-2 font-medium text-sm text-white"
									href={workspace.onboarding.nextRoute}
								>
									Continue onboarding
								</a>
							) : null}
						</section>
					) : (
						renderActiveDealPortalContent(workspace)
					)}
				</section>
			</div>
		</main>
	);
}

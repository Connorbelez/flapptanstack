import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useAction } from "convex/react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import {
	buildLawyerOnboardingSessionPath,
	buildVerifiedLawyerReturnPath,
} from "./verify.$token";

type CompletionPhase = "idle" | "completing" | "complete";

interface CompletionResult {
	readonly dealId?: string;
	readonly reason?: string;
	readonly status: string;
}

interface ResolveResult {
	readonly status: string;
}

export function buildLawyerWorkosInvitationPath(
	invitationToken: string
): string {
	const search = new URLSearchParams({
		invitation_token: invitationToken,
	});
	return `/lawyer/invitation?${search.toString()}`;
}

function stringSearchValue(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0
		? value
		: undefined;
}

export const Route = createFileRoute("/lawyer/invitation")({
	validateSearch: (search: Record<string, unknown>) => ({
		invitationToken:
			stringSearchValue(search.invitation_token) ??
			stringSearchValue(search.invitationToken),
	}),
	component: LawyerWorkosInvitationRoute,
});

function LawyerWorkosInvitationRoute() {
	const { invitationToken } = Route.useSearch();
	return (
		<LawyerWorkosInvitationRouteContent invitationToken={invitationToken} />
	);
}

export function LawyerWorkosInvitationRouteContent({
	invitationToken,
}: {
	readonly invitationToken?: string;
}) {
	const auth = useAuth();
	const navigate = useNavigate();
	const completeInvitation = useAction(
		api.legalRepresentation.workosInvitations.completeWorkosGuestInvitation
	);
	const resolveInvitation = useAction(
		api.legalRepresentation.workosInvitations.resolveWorkosInvitationToken
	);
	const [phase, setPhase] = useState<CompletionPhase>("idle");
	const [resolveResult, setResolveResult] = useState<ResolveResult | null>(
		null
	);
	const [result, setResult] = useState<CompletionResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const redirectPath = useMemo(
		() =>
			invitationToken
				? buildLawyerWorkosInvitationPath(invitationToken)
				: "/lawyer/invitation",
		[invitationToken]
	);

	useEffect(() => {
		if (!invitationToken || resolveResult || error) {
			return;
		}
		void resolveInvitation({ invitationToken })
			.then((nextResult) => {
				setResolveResult(nextResult);
				if (nextResult.status === "not_found") {
					setError("This WorkOS invitation is not linked to an active deal.");
				}
			})
			.catch((unknownError: unknown) => {
				setError(
					unknownError instanceof Error
						? unknownError.message
						: "WorkOS invitation lookup failed."
				);
			});
	}, [error, invitationToken, resolveInvitation, resolveResult]);

	useEffect(() => {
		if (phase !== "idle" || auth.loading || !auth.user || !invitationToken) {
			return;
		}
		if (!resolveResult || resolveResult.status === "not_found") {
			return;
		}
		setPhase("completing");
		void completeInvitation({ invitationToken })
			.then(async (nextResult) => {
				if (
					"onboardingSessionId" in nextResult &&
					typeof nextResult.onboardingSessionId === "string"
				) {
					await navigate({
						href: buildLawyerOnboardingSessionPath(
							nextResult.onboardingSessionId
						),
					});
					return;
				}
				if (
					nextResult.status === "verified" &&
					"dealId" in nextResult &&
					typeof nextResult.dealId === "string"
				) {
					await navigate({
						href: buildVerifiedLawyerReturnPath(nextResult.dealId),
					});
					return;
				}
				setResult(nextResult as CompletionResult);
				setPhase("complete");
			})
			.catch((unknownError: unknown) => {
				setError(
					unknownError instanceof Error
						? unknownError.message
						: "WorkOS invitation completion failed."
				);
				setPhase("complete");
			});
	}, [
		auth.loading,
		auth.user,
		completeInvitation,
		invitationToken,
		navigate,
		phase,
		resolveResult,
	]);

	if (!invitationToken) {
		return (
			<LawyerInvitationShell
				body="The WorkOS invitation token is missing from this link."
				title="Invitation link incomplete"
			/>
		);
	}

	if (auth.loading || !(resolveResult || error)) {
		return (
			<LawyerInvitationShell
				body="Checking your WorkOS session before connecting this deal."
				title="Preparing invitation"
			/>
		);
	}

	if (!auth.user) {
		return (
			<LawyerInvitationShell
				actions={
					<div className="flex flex-wrap gap-2">
						<Link
							className="rounded-md bg-slate-950 px-3 py-2 font-medium text-sm text-white"
							search={{
								invitationToken,
								redirect: redirectPath,
							}}
							to="/sign-in"
						>
							Sign in
						</Link>
						<Link
							className="rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-900 text-sm"
							search={{
								invitationToken,
								redirect: redirectPath,
							}}
							to="/sign-up"
						>
							Create account
						</Link>
					</div>
				}
				body="Sign in or create your WorkOS account to accept this FairLend deal invitation."
				title="WorkOS sign-in required"
			/>
		);
	}

	if (phase === "completing") {
		return (
			<LawyerInvitationShell
				body="Validating the WorkOS invitation and connecting your lawyer access to the deal."
				title="Completing invitation"
			/>
		);
	}

	if (error) {
		return <LawyerInvitationShell body={error} title="Invitation failed" />;
	}

	if (result) {
		return (
			<LawyerInvitationShell
				body={result.reason ?? "The invitation could not be completed."}
				title={`Invitation ${result.status}`}
			/>
		);
	}

	return (
		<LawyerInvitationShell
			body="Starting invitation completion."
			title="Completing invitation"
		/>
	);
}

function LawyerInvitationShell({
	actions,
	body,
	title,
}: {
	readonly actions?: ReactNode;
	readonly body: string;
	readonly title: string;
}) {
	return (
		<main className="min-h-[60vh] bg-slate-50 px-6 py-16 text-slate-950">
			<section className="mx-auto max-w-2xl space-y-5">
				<div className="space-y-2">
					<p className="font-semibold text-slate-500 text-xs uppercase tracking-[0.18em]">
						Lawyer invitation
					</p>
					<h1 className="font-semibold text-3xl">{title}</h1>
					<p className="text-base text-slate-600 leading-7">{body}</p>
				</div>
				{actions ? <div>{actions}</div> : null}
			</section>
		</main>
	);
}

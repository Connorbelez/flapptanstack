import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useMutation, useQuery } from "convex/react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";

type AcceptResult =
	| {
			readonly status: "verified";
	  }
	| {
			readonly reason: string;
			readonly status:
				| "expired"
				| "failed"
				| "requires_review"
				| "revoked"
				| "used";
	  };

type AcceptPhase = "idle" | "accepting" | "complete";
type InvitationStatus = keyof typeof statusCopy | "pending";

const statusCopy = {
	accepted: {
		title: "Verification already in progress",
		body: "This invitation has already been accepted and is waiting for verification evidence.",
	},
	expired: {
		title: "Invitation expired",
		body: "Ask the deal team to resend a fresh lawyer verification link.",
	},
	failed: {
		title: "Verification needs remediation",
		body: "This invitation could not be verified. Ask the deal team to review the lawyer details and resend if appropriate.",
	},
	not_found: {
		title: "Invitation not found",
		body: "This verification link is invalid or has already been replaced.",
	},
	requires_review: {
		title: "Verification requires review",
		body: "The lawyer evidence was recorded but did not meet automatic eligibility checks.",
	},
	revoked: {
		title: "Invitation revoked",
		body: "This lawyer verification link is no longer active.",
	},
	used: {
		title: "Invitation already used",
		body: "This single-use verification link has already been completed.",
	},
	verified: {
		title: "Invitation already verified",
		body: "Your lawyer access has already been connected to this deal.",
	},
} as const;

export function buildLawyerVerifyRedirectPath(token: string): string {
	return `/lawyer/verify/${encodeURIComponent(token)}`;
}

export function getLawyerVerifyTerminalCopy(
	status: Exclude<InvitationStatus, "pending">
): (typeof statusCopy)[Exclude<InvitationStatus, "pending">] {
	return statusCopy[status];
}

export const Route = createFileRoute("/lawyer/verify/$token")({
	component: LawyerVerifyRoute,
});

function LawyerVerifyRoute() {
	const { token } = Route.useParams();
	return <LawyerVerifyRouteContent token={token} />;
}

export function LawyerVerifyRouteContent({
	token,
}: {
	readonly token: string;
}) {
	const auth = useAuth();
	const invitationStatus = useQuery(
		api.legalRepresentation.invitations.getInvitationStatusByToken,
		{ token }
	);
	const acceptInvitation = useMutation(
		api.legalRepresentation.invitations.acceptGuestInvitation
	);
	const [phase, setPhase] = useState<AcceptPhase>("idle");
	const [result, setResult] = useState<AcceptResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const redirectPath = useMemo(
		() => buildLawyerVerifyRedirectPath(token),
		[token]
	);

	useEffect(() => {
		if (
			phase !== "idle" ||
			auth.loading ||
			!auth.user ||
			invitationStatus?.status !== "pending"
		) {
			return;
		}
		setPhase("accepting");
		void acceptInvitation({ token })
			.then((nextResult) => {
				setResult(nextResult as AcceptResult);
				setPhase("complete");
			})
			.catch((unknownError: unknown) => {
				setError(
					unknownError instanceof Error
						? unknownError.message
						: "Invitation verification failed."
				);
				setPhase("complete");
			});
	}, [
		acceptInvitation,
		auth.loading,
		auth.user,
		invitationStatus?.status,
		phase,
		token,
	]);

	if (auth.loading || invitationStatus === undefined) {
		return (
			<LawyerVerifyShell
				body="Checking the invitation and WorkOS session."
				title="Preparing verification"
			/>
		);
	}

	if (!auth.user) {
		return (
			<LawyerVerifyShell
				actions={
					<div className="flex flex-wrap gap-2">
						<Link
							className="rounded-md bg-slate-950 px-3 py-2 font-medium text-sm text-white"
							search={{ redirect: redirectPath }}
							to="/sign-in"
						>
							Sign in
						</Link>
						<Link
							className="rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-900 text-sm"
							search={{ redirect: redirectPath }}
							to="/sign-up"
						>
							Create account
						</Link>
					</div>
				}
				body="Sign in or create a lawyer account to continue this deal-scoped verification."
				title="WorkOS sign-in required"
			/>
		);
	}

	if (invitationStatus.status !== "pending") {
		const copy = statusCopy[invitationStatus.status];
		return <LawyerVerifyShell body={copy.body} title={copy.title} />;
	}

	if (phase === "accepting") {
		return (
			<LawyerVerifyShell
				body="Resolving your WorkOS identity, checking lawyer evidence, and connecting deal access."
				title="Verifying invitation"
			/>
		);
	}

	if (error) {
		return (
			<LawyerVerifyShell
				body={error}
				title="Verification could not be completed"
			/>
		);
	}

	if (result?.status === "verified") {
		return (
			<LawyerVerifyShell
				actions={
					<Link
						className="rounded-md bg-slate-950 px-3 py-2 font-medium text-sm text-white"
						to="/lawyer"
					>
						Open lawyer workspace
					</Link>
				}
				body="Your WorkOS lawyer identity is linked to the invited deal."
				title="Invitation verified"
			/>
		);
	}

	if (result) {
		const copy = statusCopy[result.status];
		return (
			<LawyerVerifyShell
				body={`${copy.body} ${result.reason}`}
				title={copy.title}
			/>
		);
	}

	return (
		<LawyerVerifyShell
			body="Starting invitation verification."
			title="Verifying invitation"
		/>
	);
}

function LawyerVerifyShell({
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
						Lawyer verification
					</p>
					<h1 className="font-semibold text-3xl">{title}</h1>
					<p className="text-base text-slate-600 leading-7">{body}</p>
				</div>
				{actions ? <div>{actions}</div> : null}
			</section>
		</main>
	);
}

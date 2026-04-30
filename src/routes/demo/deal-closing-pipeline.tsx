import { createFileRoute } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import {
	type DealClosingPipelineCreateSigningSessionArgs,
	DealClosingPipelineDemo,
	type DealClosingPipelineSigningSession,
} from "#/components/demo/deal-closing/DealClosingPipelineDemo";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const TRAILING_SLASHES = /\/+$/;

export const Route = createFileRoute("/demo/deal-closing-pipeline")({
	ssr: false,
	component: DealClosingPipelineRoute,
});

export function extractDocumensoSigningToken(value: string): string | null {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return null;
	}

	try {
		const parsed = new URL(trimmed);
		const tokenParam = parsed.searchParams.get("token");
		if (tokenParam?.trim()) {
			return tokenParam.trim();
		}

		const pathToken = parsed.pathname.split("/").filter(Boolean).at(-1)?.trim();
		return pathToken ? decodeURIComponent(pathToken) : null;
	} catch {
		const withoutHash = trimmed.split("#", 1)[0] ?? trimmed;
		const withoutQuery = withoutHash.split("?", 1)[0] ?? withoutHash;
		const pathToken = withoutQuery
			.replace(TRAILING_SLASHES, "")
			.split("/")
			.filter(Boolean)
			.at(-1)
			?.trim();
		return pathToken ? decodeURIComponent(pathToken) : null;
	}
}

function extractDocumensoHost(value: string): string | null {
	try {
		return new URL(value).origin;
	} catch {
		return null;
	}
}

function DealClosingPipelineRoute() {
	const state = useQuery(api.demo.dealClosingPipeline.getState, {});
	const portalDocumentPackage = useQuery(
		api.documents.dealPackages.getPortalDocumentPackage,
		state?.deal?.id ? { dealId: state.deal.id } : "skip"
	);
	const resetAndRegenerate = useAction(
		api.demo.dealClosingPipeline.resetAndRegenerate
	);
	const createEmbeddedSigningSession = useAction(
		api.documents.signature.sessions.createEmbeddedSigningSession
	);
	const [resetPending, setResetPending] = useState(false);
	const [signingSession, setSigningSession] =
		useState<DealClosingPipelineSigningSession | null>(null);

	const renderedState = useMemo(() => {
		if (!state) {
			return state;
		}

		return {
			...state,
			portalDocumentPackage,
		};
	}, [portalDocumentPackage, state]);

	const handleReset = useCallback(async () => {
		setResetPending(true);
		setSigningSession(null);
		try {
			await resetAndRegenerate({});
		} finally {
			setResetPending(false);
		}
	}, [resetAndRegenerate]);

	const handleCreateSigningSession = useCallback(
		async ({
			dealId,
			instanceId,
		}: DealClosingPipelineCreateSigningSessionArgs) => {
			setSigningSession({
				error: null,
				expiresAt: null,
				host: null,
				instanceId,
				isPending: true,
				token: null,
				url: null,
			});

			try {
				const session = await createEmbeddedSigningSession({
					dealId: dealId as Id<"deals">,
					instanceId: instanceId as Id<"dealDocumentInstances">,
				});
				const token = extractDocumensoSigningToken(session.url);
				setSigningSession({
					error: token
						? null
						: "Documenso returned a signing URL without a recipient token.",
					expiresAt: session.expiresAt ?? null,
					host: extractDocumensoHost(session.url),
					instanceId,
					isPending: false,
					token,
					url: session.url,
				});
			} catch (error) {
				setSigningSession({
					error:
						error instanceof Error
							? error.message
							: "Failed to create embedded signing session.",
					expiresAt: null,
					host: null,
					instanceId,
					isPending: false,
					token: null,
					url: null,
				});
			}
		},
		[createEmbeddedSigningSession]
	);

	return (
		<DealClosingPipelineDemo
			onCreateSigningSession={handleCreateSigningSession}
			onReset={handleReset}
			resetPending={resetPending}
			signingSession={signingSession}
			state={renderedState}
		/>
	);
}

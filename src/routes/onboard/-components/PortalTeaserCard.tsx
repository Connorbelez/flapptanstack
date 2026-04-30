import { useQuery } from "convex/react";
import { ExternalLink, Globe2, ShieldCheck } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { api } from "../../../../convex/_generated/api";
import type { BrokerOnboardingApplication } from "../-lib/viewModel";
import { getPortalPreviewSeed } from "../-lib/viewModel";

interface PortalTeaserCardProps {
	application: BrokerOnboardingApplication;
	onSlugChange?: (slug: string) => void;
}

function getAvailabilityLabel(
	preview:
		| {
				available: boolean;
				conflictReason: "empty" | "reserved" | "taken" | null;
		  }
		| undefined
) {
	if (!preview) {
		return "Checking";
	}
	if (preview.available) {
		return "Available to request";
	}
	if (preview.conflictReason === "reserved") {
		return "Reserved word";
	}
	if (preview.conflictReason === "empty") {
		return "Enter a slug";
	}
	return "Already in use";
}

export function PortalTeaserCard({
	application,
	onSlugChange,
}: PortalTeaserCardProps) {
	const seed = getPortalPreviewSeed(application);
	const preview = useQuery(api.portals.queries.previewPortalSlugCandidate, {
		slug: application.draftData.requestedPortalSlug ?? seed.normalizedSlug,
	});
	const hosts = preview?.hosts ?? seed.hosts;
	const normalizedSlug = preview?.normalizedSlug ?? seed.normalizedSlug;
	const availabilityLabel = getAvailabilityLabel(preview);

	return (
		<section className="rounded-lg border border-teal-900/10 bg-white p-5 shadow-sm">
			<div className="flex items-start justify-between gap-4">
				<div>
					<div className="flex items-center gap-2 text-teal-700">
						<Globe2 className="size-4" />
						<p className="font-medium text-sm">Portal preview</p>
					</div>
					<h2 className="mt-2 font-semibold text-2xl tracking-normal">
						Your branded FairLend portal
					</h2>
				</div>
				<Badge variant={preview?.available ? "secondary" : "outline"}>
					{availabilityLabel}
				</Badge>
			</div>

			<div className="mt-5 rounded-md border bg-stone-50 p-4">
				<div className="flex items-center gap-2 text-stone-500 text-xs">
					<ShieldCheck className="size-3.5 text-teal-700" />
					Slug normalization and host preview use the shared portal contract.
				</div>
				<div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
					<div className="grid gap-2">
						<Label htmlFor="portal-slug">Preferred portal slug</Label>
						<Input
							id="portal-slug"
							onChange={(event) => onSlugChange?.(event.target.value)}
							placeholder="meridian-capital"
							value={application.draftData.requestedPortalSlug ?? ""}
						/>
					</div>
					<div className="rounded-md border bg-white px-3 py-2 text-sm">
						<span className="text-stone-500">Normalized</span>{" "}
						<strong>{normalizedSlug}</strong>
					</div>
				</div>
				<div className="mt-4 grid gap-2 text-sm">
					<a
						className="inline-flex items-center gap-2 text-teal-700"
						href={`https://${hosts.productionHost}`}
					>
						{hosts.productionHost}
						<ExternalLink className="size-3.5" />
					</a>
					<p className="text-stone-500">{hosts.localHost}</p>
				</div>
			</div>

			<p className="mt-4 text-sm text-stone-600">
				This preview does not claim a namespace. FairLend reserves and activates
				the portal only after verification, review, and downstream provisioning
				complete.
			</p>
		</section>
	);
}

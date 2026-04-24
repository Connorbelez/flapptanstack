import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import {
	type AppendBrokerNoteFn,
	type BrokerOnboardingReadModel,
	getStatusLabel,
	getSubmittedDetails,
} from "../-lib/viewModel";
import { PortalTeaserCard } from "./PortalTeaserCard";
import { ReviewThreadComposer } from "./ReviewThreadComposer";

interface OnboardingStatusPageProps {
	appendBrokerNote: AppendBrokerNoteFn;
	readModel: BrokerOnboardingReadModel;
}

function statusIcon(status: string) {
	if (status === "activated") {
		return <CheckCircle2 className="size-5 text-teal-700" />;
	}
	if (status === "rejected") {
		return <XCircle className="size-5 text-destructive" />;
	}
	return <Clock3 className="size-5 text-amber-700" />;
}

function getStatusHeading(status: string) {
	switch (status) {
		case "submitted":
			return "Your application is with FairLend review.";
		case "approved":
			return "Approved. Provisioning is still in flight.";
		case "activated":
			return "Your broker portal is active.";
		case "rejected":
			return "FairLend could not approve this application.";
		default:
			return "Broker onboarding status";
	}
}

export function OnboardingStatusPage({
	appendBrokerNote,
	readModel,
}: OnboardingStatusPageProps) {
	const application = readModel.application;
	const submittedDetails = getSubmittedDetails(application);
	const isApprovedNotActivated = application.status === "approved";

	return (
		<main className="min-h-[calc(100vh-4rem)] bg-stone-50 px-4 py-8 text-stone-950">
			<div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_380px]">
				<div className="grid gap-6">
					<section className="rounded-lg border bg-white p-6 shadow-sm">
						<div className="flex items-center gap-3">
							{statusIcon(application.status)}
							<Badge variant="outline">
								{getStatusLabel(application.status)}
							</Badge>
						</div>
						<h1 className="mt-4 font-semibold text-4xl tracking-normal">
							{getStatusHeading(application.status)}
						</h1>
						<p className="mt-3 max-w-3xl text-stone-600">
							{isApprovedNotActivated
								? "Approval is not the final activation state. We will show the broker as activated only after downstream provisioning and portal assignment complete."
								: "This page reloads the server-owned application, verification, handoff, and review-thread projections."}
						</p>
					</section>

					<section className="rounded-lg border bg-white p-5 shadow-sm">
						<h2 className="font-semibold text-xl tracking-normal">
							Submitted details
						</h2>
						<div className="mt-4 grid gap-3 sm:grid-cols-2">
							{submittedDetails.map((item) => (
								<div
									className="rounded-md border bg-stone-50 p-3"
									key={item.label}
								>
									<p className="text-stone-500 text-xs">{item.label}</p>
									<p className="mt-1 font-medium text-sm">{item.value}</p>
								</div>
							))}
						</div>
					</section>

					<PortalTeaserCard application={application} />
				</div>

				<ReviewThreadComposer
					appendBrokerNote={appendBrokerNote}
					readModel={readModel}
				/>
			</div>
		</main>
	);
}

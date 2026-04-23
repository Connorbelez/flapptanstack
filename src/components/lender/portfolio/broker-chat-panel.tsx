import {
	Building2,
	Mail,
	MessageSquareText,
	Phone,
	UserRoundX,
	Waypoints,
} from "lucide-react";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Separator } from "#/components/ui/separator";
import { Textarea } from "#/components/ui/textarea";
import { formatPortfolioEnumLabel } from "./portfolio-formatters";
import type {
	PortfolioBrokerContextSource,
	PortfolioCommandCenterSnapshot,
} from "./portfolio-types";

type PortfolioActionItem =
	PortfolioCommandCenterSnapshot["actionsRequired"]["items"][number];
type PortfolioBrokerCoordination =
	PortfolioCommandCenterSnapshot["brokerCoordination"];
type PortfolioBrokerPrefillContext = PortfolioActionItem["prefillContext"];

export interface BrokerChatPanelProps {
	brokerCoordination: PortfolioBrokerCoordination;
	onSelectPrefillContext: (context: PortfolioBrokerPrefillContext) => void;
	selectedPrefillContext?: PortfolioBrokerPrefillContext | null;
	selectedPrefillSource?: PortfolioBrokerContextSource | null;
}

function getBrokerInitials(name: string) {
	return name
		.split(" ")
		.map((segment) => segment.slice(0, 1).toUpperCase())
		.join("")
		.slice(0, 2);
}

function hasSamePrefillContext(
	left: PortfolioBrokerPrefillContext | null | undefined,
	right: PortfolioBrokerPrefillContext
) {
	return (
		left?.contextType === right.contextType &&
		left?.subjectId === right.subjectId
	);
}

function buildDraftMessage(
	context: PortfolioBrokerPrefillContext | null | undefined
) {
	if (!context) {
		return "";
	}

	return [
		context.title,
		"",
		context.summary,
		"",
		`Property: ${context.propertyLabel}`,
	].join("\n");
}

function buildBrokerContactHref(
	contact: PortfolioBrokerCoordination["fallbackContactCta"],
	context: PortfolioBrokerPrefillContext | null | undefined
) {
	if (!contact?.value) {
		return null;
	}

	switch (contact.mode) {
		case "email": {
			const query = new URLSearchParams();
			if (context) {
				query.set("subject", context.title);
				query.set("body", buildDraftMessage(context));
			}
			const suffix = query.toString();
			return `mailto:${contact.value}${suffix ? `?${suffix}` : ""}`;
		}
		case "phone":
			return `tel:${contact.value}`;
		case "profile":
			return null;
		default:
			return null;
	}
}

function buildTransportBadgeLabel(coordination: PortfolioBrokerCoordination) {
	if (coordination.threadId) {
		return "Thread linked";
	}

	return coordination.availabilityState === "missing_broker"
		? "Missing broker"
		: "Fallback contact";
}

function renderBrokerContactAction(
	brokerCoordination: PortfolioBrokerCoordination,
	contactHref: string | null
) {
	const contact = brokerCoordination.fallbackContactCta;

	if (contact && contactHref) {
		return (
			<Button asChild className="w-full sm:w-auto">
				<a data-testid="broker-contact-cta" href={contactHref}>
					{contact.label}
				</a>
			</Button>
		);
	}

	if (contact) {
		return (
			<Button data-testid="broker-contact-cta-disabled" disabled>
				{contact.label}
			</Button>
		);
	}

	return (
		<p className="text-muted-foreground text-sm leading-6">
			Broker contact details will appear here once an assignment is available.
		</p>
	);
}

export function BrokerChatPanel({
	brokerCoordination,
	onSelectPrefillContext,
	selectedPrefillContext,
	selectedPrefillSource,
}: BrokerChatPanelProps) {
	const broker = brokerCoordination.assignedBroker;
	const draftMessage = buildDraftMessage(selectedPrefillContext);
	const contactHref = buildBrokerContactHref(
		brokerCoordination.fallbackContactCta,
		selectedPrefillContext
	);
	const prefillSections = [
		{
			items: brokerCoordination.prefillContextPayloads.mortgageFollowUps,
			label: "Mortgage follow-ups",
		},
		{
			items: brokerCoordination.prefillContextPayloads.paymentFollowUps,
			label: "Payment follow-ups",
		},
		{
			items: brokerCoordination.prefillContextPayloads.dealFollowUps,
			label: "Deal follow-ups",
		},
	].filter((section) => section.items.length > 0);
	const selectedBrokerPrefillContext =
		selectedPrefillSource === "broker" ? selectedPrefillContext : null;

	return (
		<section
			className="rounded-xl border border-border/70 bg-background"
			data-testid="broker-chat-panel"
		>
			<div className="flex flex-wrap items-start justify-between gap-3 border-border/70 border-b px-4 py-4">
				<div className="space-y-1.5">
					<div className="flex items-center gap-2">
						<MessageSquareText className="size-4 text-muted-foreground" />
						<h3 className="font-semibold text-base">Broker Chat</h3>
					</div>
					<p className="text-muted-foreground text-sm leading-6">
						Day-one coordination stays assigned-broker oriented and reuses the
						explicit broker contract instead of inventing an inbox or live
						transport state in the UI.
					</p>
				</div>
				<Badge variant="outline">
					{buildTransportBadgeLabel(brokerCoordination)}
				</Badge>
			</div>

			<div className="space-y-4 p-4">
				{broker ? (
					<div
						className="flex items-start gap-3 rounded-xl border border-border/70 p-4"
						data-testid="broker-chat-assigned"
					>
						<Avatar size="lg">
							<AvatarFallback>{getBrokerInitials(broker.name)}</AvatarFallback>
						</Avatar>
						<div className="space-y-1.5">
							<div className="flex flex-wrap items-center gap-2">
								<p className="font-medium text-sm">{broker.name}</p>
								{broker.brokerageName ? (
									<Badge variant="outline">{broker.brokerageName}</Badge>
								) : null}
							</div>
							<p className="text-muted-foreground text-sm leading-6">
								Availability is{" "}
								{formatPortfolioEnumLabel(
									brokerCoordination.availabilityState
								).toLowerCase()}
								. The rail keeps direct coordination available even before live
								in-app chat is ready.
							</p>
							<div className="flex flex-wrap gap-3 text-muted-foreground text-xs">
								{broker.email ? (
									<span className="flex items-center gap-1.5">
										<Mail className="size-3.5" />
										{broker.email}
									</span>
								) : null}
								{broker.phoneNumber ? (
									<span className="flex items-center gap-1.5">
										<Phone className="size-3.5" />
										{broker.phoneNumber}
									</span>
								) : null}
							</div>
						</div>
					</div>
				) : (
					<div
						className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
						data-testid="broker-chat-missing"
					>
						<div className="flex items-start gap-3">
							<div className="rounded-full bg-amber-500/15 p-2 text-amber-700 dark:text-amber-300">
								<UserRoundX className="size-4" />
							</div>
							<div className="space-y-1.5">
								<p className="font-medium text-sm">Broker assignment missing</p>
								<p className="text-muted-foreground text-sm leading-6">
									The rail remains visible while assignment is restored so the
									lender does not lose the coordination context or action feed.
								</p>
							</div>
						</div>
					</div>
				)}

				<div
					className="rounded-xl border border-border/70 p-4"
					data-testid="broker-chat-prefill"
				>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<p className="font-medium text-sm">Selected handoff</p>
						{selectedPrefillContext ? (
							<Badge variant="outline">
								{formatPortfolioEnumLabel(selectedPrefillContext.contextType)}
							</Badge>
						) : null}
					</div>
					{selectedPrefillContext ? (
						<div className="mt-3 space-y-3">
							<div className="space-y-1">
								<p className="font-medium text-sm">
									{selectedPrefillContext.title}
								</p>
								<p className="text-muted-foreground text-sm">
									{selectedPrefillContext.propertyLabel}
								</p>
							</div>
							<Textarea
								className="min-h-28 resize-none"
								data-testid="broker-prefill-textarea"
								readOnly
								value={draftMessage}
							/>
						</div>
					) : (
						<p className="mt-3 text-muted-foreground text-sm leading-6">
							Choose an action above or a suggested follow-up below to prefill
							the broker handoff.
						</p>
					)}
				</div>

				{prefillSections.length > 0 ? (
					<div className="space-y-3">
						<div className="flex items-center gap-2 font-medium text-sm">
							<Waypoints className="size-4 text-muted-foreground" />
							Suggested handoffs
						</div>
						{prefillSections.map((section, sectionIndex) => (
							<div className="space-y-2" key={section.label}>
								{sectionIndex > 0 ? <Separator /> : null}
								<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
									{section.label}
								</p>
								<div className="flex flex-wrap gap-2">
									{section.items.map((context) => (
										<Button
											data-testid={`broker-prefill-option-${context.subjectId}`}
											key={`${context.contextType}:${context.subjectId}`}
											onClick={() => onSelectPrefillContext(context)}
											size="sm"
											type="button"
											variant={
												hasSamePrefillContext(
													selectedBrokerPrefillContext,
													context
												)
													? "secondary"
													: "outline"
											}
										>
											{context.title}
										</Button>
									))}
								</div>
							</div>
						))}
					</div>
				) : null}

				<div className="rounded-xl border border-border/70 bg-muted/20 p-4">
					<div className="space-y-3">
						<div className="flex items-center gap-2 font-medium text-sm">
							<Building2 className="size-4 text-muted-foreground" />
							Broker handoff
						</div>
						{renderBrokerContactAction(brokerCoordination, contactHref)}
						<p className="text-muted-foreground text-xs leading-5">
							Live rail chat transport is not enabled in this slice yet. This
							panel stays contract-backed and non-destructive by routing the
							handoff through the explicit broker coordination CTA.
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}

"use client";

import { Link, useRouter } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronDown } from "lucide-react";
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminDescriptionHelp } from "#/components/admin/AdminDescriptionHelp";
import { DealPortalLinks } from "#/components/admin/deals/DealPortalLinks";
import {
	DocumentRemediationPanel,
	type DocumentRemediationPanelDocument,
} from "#/components/admin/deals/DocumentRemediationPanel";
import { FeeValue } from "#/components/admin/fees/fee-value";
import { BrokerReassignmentDialog } from "#/components/admin/lenders/BrokerReassignmentDialog";
import { MortgagePackageApplyButton } from "#/components/admin/mortgages/MortgagePackageApplyButton";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "#/components/ui/accordion";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "#/components/ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";
import { EMPTY_ADMIN_DETAIL_SEARCH } from "#/lib/admin-detail-search";
import type { AdminRelationNavigationTarget } from "#/lib/admin-relation-navigation";
import { resolveAdminObjectDef } from "#/lib/admin-view-context";
import { useAuthorization } from "#/lib/auth";
import {
	describeSigningProgress,
	groupSignableDealDocuments,
} from "#/lib/deal-document-signing-presentation";
import {
	defaultDocumentAssetName,
	uploadDocumentAsset,
} from "#/lib/documents/uploadDocumentAsset";
import {
	formatDecileCountForDisplay,
	LEDGER_UNITS_PER_DECILE,
	ledgerUnitsToDecilesExact,
} from "#/lib/mortgage-ownership-display";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import type {
	NormalizedFieldDefinition,
	UnifiedRecord,
} from "../../../../convex/crm/types";
import type { DetailSectionDefinition } from "./detail-sections";
import { SectionedRecordDetails } from "./detail-sections";
import {
	RelatedEntityExplorer,
	type RelatedEntityGroup,
} from "./RelatedEntityExplorer";

const HERO_IMAGE_SPLIT_RE = /\n+/;

function formatCurrency(value: bigint | number, divisor = 1) {
	const normalizedValue =
		typeof value === "bigint" ? Number(value) / divisor : value / divisor;
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(normalizedValue);
}

function formatCentsCurrency(value: bigint | number) {
	return formatCurrency(value, 100);
}

function formatDate(value: number | string | null | undefined) {
	if (value == null) {
		return null;
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return String(value);
	}

	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function formatDateInputValue(value: number | string | null | undefined) {
	if (value == null) {
		return "";
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}

	return date.toISOString().slice(0, 10);
}

function parseDateInputAtNoonUtc(value: string) {
	const timestamp = Date.parse(`${value}T12:00:00.000Z`);
	return Number.isFinite(timestamp) ? timestamp : null;
}

function formatDateTime(value: number | string | null | undefined) {
	if (value == null) {
		return null;
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return String(value);
	}

	return date.toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function formatEnumLabel(value: string) {
	return value
		.split("_")
		.map((segment) =>
			segment.length > 0
				? `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`
				: segment
		)
		.join(" ");
}

function formatOptionalDisplayValue(value: unknown) {
	if (value == null) {
		return "Unavailable";
	}
	return String(value);
}

function filterDetailFields(
	fields: readonly NormalizedFieldDefinition[],
	hiddenFieldNames: readonly string[]
) {
	const hidden = new Set(hiddenFieldNames);
	return fields.filter((field) => !hidden.has(field.name));
}

function DetailSectionShell({
	children,
	defaultCollapsed,
	description,
	title,
}: {
	readonly children: ReactNode;
	readonly defaultCollapsed?: boolean;
	readonly description?: string;
	readonly title: string;
}) {
	const header = (
		<>
			<h3 className="font-medium text-sm tracking-[0.02em]">{title}</h3>
			{description ? (
				<AdminDescriptionHelp
					content={description}
					label={`${title} details`}
				/>
			) : null}
		</>
	);

	if (defaultCollapsed !== undefined) {
		return (
			<Collapsible
				className="space-y-4 border-border/70 border-t pt-5"
				defaultOpen={!defaultCollapsed}
			>
				<CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-1.5 text-left">
					{header}
					<ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
				</CollapsibleTrigger>
				<CollapsibleContent>{children}</CollapsibleContent>
			</Collapsible>
		);
	}

	return (
		<section className="space-y-4 border-border/70 border-t pt-5">
			<div className="flex items-center gap-1.5">{header}</div>
			{children}
		</section>
	);
}

function EmptyContext({ message }: { readonly message: string }) {
	return <p className="text-muted-foreground text-sm">{message}</p>;
}

function MetricGrid({
	items,
}: {
	readonly items: ReadonlyArray<{ label: string; value: ReactNode }>;
}) {
	return (
		<div className="grid gap-x-6 md:grid-cols-2 xl:grid-cols-3">
			{items.map((item) => (
				<div
					className="min-w-0 border-border/60 border-t py-3"
					key={item.label}
				>
					<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
						{item.label}
					</p>
					<div className="mt-1 font-medium text-sm">{item.value}</div>
				</div>
			))}
		</div>
	);
}

function EntityPreviewValue({
	children,
	entityType,
	label,
	objectDefs,
	onNavigateRelation,
	recordId,
}: {
	readonly children: ReactNode;
	readonly entityType: string;
	readonly label: string;
	readonly objectDefs?: readonly Doc<"objectDefs">[];
	readonly onNavigateRelation?: (target: AdminRelationNavigationTarget) => void;
	readonly recordId: string;
}) {
	const objectDef = objectDefs
		? resolveAdminObjectDef(entityType, objectDefs)
		: undefined;
	const navigationTarget = objectDef
		? {
				objectDefId: String(objectDef._id),
				recordId,
				recordKind: "native" as const,
			}
		: null;
	const className =
		"text-left text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

	if (navigationTarget && onNavigateRelation) {
		return (
			<button
				aria-label={`Open ${label} detail sheet`}
				className={className}
				onClick={() => onNavigateRelation(navigationTarget)}
				type="button"
			>
				{children}
			</button>
		);
	}

	return (
		<Link
			aria-label={`Open ${label} detail sheet`}
			className={className}
			params={{ entitytype: entityType, recordid: recordId }}
			search={EMPTY_ADMIN_DETAIL_SEARCH}
			to="/admin/$entitytype/$recordid"
		>
			{children}
		</Link>
	);
}

interface EntityPreviewTarget {
	readonly entityType: string;
	readonly recordId: string;
}

function PartyPreviewMetricValue({
	children,
	label,
	objectDefs,
	onNavigateRelation,
	target,
}: {
	readonly children: ReactNode;
	readonly label: string;
	readonly objectDefs?: readonly Doc<"objectDefs">[];
	readonly onNavigateRelation?: (target: AdminRelationNavigationTarget) => void;
	readonly target: EntityPreviewTarget | null;
}) {
	if (!target) {
		return <>{children}</>;
	}

	return (
		<EntityPreviewValue
			entityType={target.entityType}
			label={label}
			objectDefs={objectDefs}
			onNavigateRelation={onNavigateRelation}
			recordId={target.recordId}
		>
			{children}
		</EntityPreviewValue>
	);
}

function formatNamedPartyDisplay(
	name: string,
	email: string | null | undefined
) {
	if (email) {
		return `${name} (${email})`;
	}

	return name;
}

function EssentialGrid({
	items,
}: {
	readonly items: ReadonlyArray<{
		emphasis?: boolean;
		label: string;
		value: ReactNode;
	}>;
}) {
	return (
		<div className="grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
			{items.map((item) => (
				<div className="min-w-0" key={item.label}>
					<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
						{item.label}
					</p>
					<div
						className={
							item.emphasis
								? "mt-1 break-words font-medium text-lg leading-7"
								: "mt-1 break-words font-medium text-sm leading-6"
						}
					>
						{item.value}
					</div>
				</div>
			))}
		</div>
	);
}

function StatusDistribution({
	emptyLabel = "No rows",
	segments,
}: {
	readonly emptyLabel?: string;
	readonly segments: ReadonlyArray<{
		className?: string;
		count: number;
		label: string;
	}>;
}) {
	const visibleSegments = segments.filter((segment) => segment.count > 0);
	const total = visibleSegments.reduce(
		(sum, segment) => sum + segment.count,
		0
	);
	if (total === 0) {
		return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;
	}

	return (
		<div className="space-y-2">
			<div
				aria-label={visibleSegments
					.map((segment) => `${segment.label}: ${segment.count}`)
					.join(", ")}
				className="flex h-2 overflow-hidden rounded-full bg-muted"
				role="img"
			>
				{visibleSegments.map((segment) => (
					<div
						className={segment.className ?? "bg-primary"}
						key={segment.label}
						style={{ width: `${(segment.count / total) * 100}%` }}
					/>
				))}
			</div>
			<div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
				{visibleSegments.map((segment) => (
					<span key={segment.label}>
						{segment.label} {segment.count}
					</span>
				))}
			</div>
		</div>
	);
}

function getObligationStatusSegmentClass(label: string) {
	if (label === "processing" || label === "pending") {
		return "bg-sky-500";
	}
	if (label === "settled") {
		return "bg-emerald-500";
	}
	if (label === "failed") {
		return "bg-destructive";
	}
	return "bg-muted-foreground";
}

function getScheduleStatusSegmentClass(label: string) {
	if (label === "active") {
		return "bg-emerald-500";
	}
	if (label === "sync_error") {
		return "bg-destructive";
	}
	return "bg-muted-foreground";
}

function CompactTimeline({
	items,
}: {
	readonly items: ReadonlyArray<{
		date: ReactNode;
		label: string;
		meta?: ReactNode;
		status?: ReactNode;
	}>;
}) {
	if (items.length === 0) {
		return <EmptyContext message="No dated events available." />;
	}

	return (
		<div className="divide-y divide-border/60 border-border/60 border-y">
			{items.map((item) => (
				<div
					className="grid gap-2 py-3 sm:grid-cols-[8rem_minmax(0,1fr)_auto]"
					key={item.label}
				>
					<div className="text-muted-foreground text-sm">{item.date}</div>
					<div className="min-w-0">
						<p className="font-medium text-sm">{item.label}</p>
						{item.meta ? (
							<p className="text-muted-foreground text-xs">{item.meta}</p>
						) : null}
					</div>
					{item.status ? <div>{item.status}</div> : null}
				</div>
			))}
		</div>
	);
}

function CompactList({
	emptyMessage,
	items,
	renderItem,
}: {
	readonly emptyMessage: string;
	readonly items: readonly unknown[];
	readonly renderItem: (item: unknown, index: number) => ReactNode;
}) {
	if (items.length === 0) {
		return <EmptyContext message={emptyMessage} />;
	}

	return (
		<div className="divide-y divide-border/60">{items.map(renderItem)}</div>
	);
}

function ListingDetailSection({
	children,
	description,
	title,
}: {
	readonly children: ReactNode;
	readonly description?: string;
	readonly title: string;
}) {
	return (
		<section className="space-y-4 border-border/70 border-t pt-6">
			<div className="flex items-center gap-1.5">
				<h3 className="font-medium text-base">{title}</h3>
				{description ? (
					<AdminDescriptionHelp
						content={description}
						label={`${title} details`}
					/>
				) : null}
			</div>
			{children}
		</section>
	);
}

function ListingFactList({
	items,
}: {
	readonly items: ReadonlyArray<{ label: string; value: ReactNode }>;
}) {
	return (
		<dl className="divide-y divide-border/60 border-border/70 border-y">
			{items.map((item) => (
				<div
					className="grid gap-2 py-3 sm:grid-cols-[11rem_minmax(0,1fr)]"
					key={item.label}
				>
					<dt className="text-muted-foreground text-xs uppercase tracking-[0.1em]">
						{item.label}
					</dt>
					<dd className="min-w-0 break-words font-medium text-sm leading-6">
						{item.value}
					</dd>
				</div>
			))}
		</dl>
	);
}

const retryingDealPackageIds = new Set<string>();

function PaymentSnapshotSection({
	snapshot,
}: {
	readonly snapshot: MortgageDetailContext["paymentSnapshot"] | undefined;
}) {
	return (
		<DetailSectionShell
			description="Canonical mortgage payment snapshot reused from the backend read model."
			title="Payment Snapshot"
		>
			{snapshot ? (
				<div className="space-y-4">
					<div className="flex flex-wrap gap-2">
						<Badge variant="outline">
							Most Recent: {formatEnumLabel(snapshot.mostRecentPaymentStatus)}
						</Badge>
						<Badge variant="outline">
							Next Upcoming:{" "}
							{formatEnumLabel(snapshot.nextUpcomingPaymentStatus)}
						</Badge>
					</div>
					<MetricGrid
						items={[
							{
								label: "Most Recent Payment",
								value:
									snapshot.mostRecentPaymentAmount !== null
										? formatCurrency(snapshot.mostRecentPaymentAmount, 100)
										: "None",
							},
							{
								label: "Most Recent Date",
								value: formatDateTime(snapshot.mostRecentPaymentDate) ?? "None",
							},
							{
								label: "Most Recent Status",
								value: formatEnumLabel(snapshot.mostRecentPaymentStatus),
							},
							{
								label: "Next Upcoming Payment",
								value:
									snapshot.nextUpcomingPaymentAmount !== null
										? formatCurrency(snapshot.nextUpcomingPaymentAmount, 100)
										: "None",
							},
							{
								label: "Next Upcoming Date",
								value:
									formatDateTime(snapshot.nextUpcomingPaymentDate) ?? "None",
							},
							{
								label: "Next Upcoming Status",
								value: formatEnumLabel(snapshot.nextUpcomingPaymentStatus),
							},
						]}
					/>
				</div>
			) : (
				<EmptyContext message="No mortgage payment snapshot available." />
			)}
		</DetailSectionShell>
	);
}

function formatPropertyLabel(
	property:
		| {
				city: string;
				province: string;
				streetAddress: string;
		  }
		| null
		| undefined
) {
	if (!property) {
		return null;
	}

	return [property.streetAddress, property.city, property.province]
		.filter(Boolean)
		.join(", ");
}

const MORTGAGE_BASE_SECTIONS = [
	{
		title: "Summary",
		description: "Primary mortgage economics, parties, and lifecycle state.",
		fieldNames: [
			"principal",
			"interestRate",
			"loanType",
			"termMonths",
			"maturityDate",
			"lienPosition",
			"status",
		],
	},
] as const satisfies readonly DetailSectionDefinition[];

const OBLIGATION_BASE_SECTIONS = [
	{
		title: "Payment State",
		description: "Current payment posture and lifecycle markers.",
		fieldNames: [
			"paymentNumber",
			"type",
			"amount",
			"amountSettled",
			"paymentProgressSummary",
			"dueDate",
			"gracePeriodEnd",
			"settledAt",
			"status",
		],
	},
] as const satisfies readonly DetailSectionDefinition[];

const BORROWER_BASE_SECTIONS = [
	{
		title: "Verification",
		description: "Borrower identity and lifecycle state.",
		fieldNames: ["status", "idvStatus", "verificationSummary", "onboardedAt"],
	},
] as const satisfies readonly DetailSectionDefinition[];

function heroImagesToStorageIdText(
	heroImages: ReadonlyArray<{ storageId: Id<"_storage"> }> | undefined
) {
	return heroImages?.map((image) => String(image.storageId)).join("\n") ?? "";
}

function parseHeroImageStorageIds(value: string) {
	return value
		.split(HERO_IMAGE_SPLIT_RE)
		.map((entry) => entry.trim())
		.filter(Boolean)
		.map((storageId) => ({ storageId: storageId as Id<"_storage"> }));
}

function parseDisplayOrder(value: string) {
	if (!value.trim()) {
		return undefined;
	}

	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function formatLedgerUnitsAsMarketplaceFractions(
	units: number | null | undefined
) {
	if (typeof units !== "number") {
		return "Uncapped";
	}

	return `${formatDecileCountForDisplay(
		ledgerUnitsToDecilesExact(units)
	)} / 10`;
}

function buildListingCurationFormState(listing: {
	adminNotes: string | null;
	description: string | null;
	displayOrder: number | null;
	featured: boolean;
	heroImages: Array<{ storageId: Id<"_storage"> }>;
	marketplaceCopy: string | null;
	seoSlug: string | null;
	title: string | null;
}) {
	return {
		adminNotes: listing.adminNotes ?? "",
		description: listing.description ?? "",
		displayOrder:
			typeof listing.displayOrder === "number"
				? String(listing.displayOrder)
				: "",
		featured: listing.featured,
		heroImages: heroImagesToStorageIdText(listing.heroImages),
		marketplaceCopy: listing.marketplaceCopy ?? "",
		seoSlug: listing.seoSlug ?? "",
		title: listing.title ?? "",
	};
}

export function shouldHydrateListingCurationForm(
	currentListingId: Id<"listings"> | null,
	listing: { listingId: Id<"listings"> } | null | undefined
) {
	return Boolean(listing && currentListingId !== listing.listingId);
}

interface MortgageDocumentListItem {
	archivedAt: number | null;
	asset: {
		assetId: string;
		fileRef: string;
		name: string;
		url?: string | null;
	} | null;
	blueprintId: string;
	class: string;
	description: string | null;
	displayName: string;
	displayOrder: number;
	packageLabel: string | null;
	status: string;
	templateId: string | null;
	templateName: string | null;
	templateVersion: number | null;
}

type MortgageDetailContext = FunctionReturnType<
	typeof api.crm.detailContextQueries.getMortgageDetailContext
>;

type ListingDetailContext = FunctionReturnType<
	typeof api.crm.detailContextQueries.getListingDetailContext
>;

type ListingCurationFormState = ReturnType<
	typeof buildListingCurationFormState
>;

type DealDetailContext = FunctionReturnType<
	typeof api.crm.detailContextQueries.getDealDetailContext
>;

type LenderDetailContext = FunctionReturnType<
	typeof api.crm.detailContextQueries.getLenderDetailContext
>;

type BrokerDetailContext = FunctionReturnType<
	typeof api.crm.detailContextQueries.getBrokerDetailContext
>;

type DealDocumentInstanceListItem = NonNullable<
	NonNullable<DealDetailContext>["documentInstances"]
>[number];

type ListingPublicDocumentListItem = NonNullable<
	NonNullable<ListingDetailContext>["publicDocuments"]
>[number];

function groupDealDocumentInstances(
	documentInstances: readonly DealDocumentInstanceListItem[]
) {
	const groupedSignableDocuments =
		groupSignableDealDocuments(documentInstances);

	return {
		activeSignableDocuments: groupedSignableDocuments.activeSignableDocuments,
		archivedSignableDocuments:
			groupedSignableDocuments.archivedSignableDocuments,
		generatedReadOnly: documentInstances.filter(
			(document) => document.class === "private_templated_non_signable"
		),
		privateStatic: documentInstances.filter(
			(document) => document.class === "private_static"
		),
	};
}

function signingBadgeVariant(
	status: string | null | undefined
): "destructive" | "outline" | "secondary" {
	switch (status) {
		case "archived":
		case "completed":
		case "signed":
		case "signature_partially_signed":
		case "signature_sent":
		case "sent":
		case "partially_signed":
			return "secondary";
		case "declined":
		case "voided":
		case "provider_error":
		case "signature_declined":
		case "signature_voided":
		case "generation_failed":
			return "destructive";
		default:
			return "outline";
	}
}

function isStaticMortgageBlueprintClass(documentClass: string) {
	return (
		documentClass === "public_static" || documentClass === "private_static"
	);
}

function MortgageBlueprintReplaceDialog({
	blueprint,
	onOpenChange,
	open,
}: {
	blueprint: MortgageDocumentListItem | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const canReviewDocumentEngine = useAuthorization({
		kind: "permission",
		permission: "document:review",
	}).allowed;
	const attachableTemplates = useQuery(
		api.admin.origination.caseDocuments.listAttachableTemplates,
		open && blueprint && !isStaticMortgageBlueprintClass(blueprint.class)
			? {}
			: "skip"
	);
	const generateUploadUrl = useMutation(api.documents.assets.generateUploadUrl);
	const extractPdfMetadata = useAction(api.documents.assets.extractPdfMetadata);
	const createAsset = useMutation(api.documents.assets.create);
	const replaceStaticBlueprint = useMutation(
		api.documents.mortgageBlueprints.replaceStaticBlueprint
	);
	const replaceTemplateBlueprint = useMutation(
		api.documents.mortgageBlueprints.replaceTemplateBlueprint
	);
	const [displayName, setDisplayName] = useState("");
	const [description, setDescription] = useState("");
	const [selectedTemplateId, setSelectedTemplateId] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fileInputKey, setFileInputKey] = useState(0);

	useEffect(() => {
		if (!blueprint) {
			setDisplayName("");
			setDescription("");
			setSelectedTemplateId("");
			setError(null);
			setFileInputKey((current) => current + 1);
			return;
		}

		setDisplayName(blueprint.displayName);
		setDescription(blueprint.description ?? "");
		setSelectedTemplateId(blueprint.templateId ?? "");
		setError(null);
		setFileInputKey((current) => current + 1);
	}, [blueprint]);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!blueprint) {
			return;
		}

		setSubmitting(true);
		setError(null);
		try {
			if (isStaticMortgageBlueprintClass(blueprint.class)) {
				const formData = new FormData(event.currentTarget);
				const file = formData.get("replacementFile");
				if (!(file instanceof File) || file.size === 0) {
					throw new Error("Choose a PDF to upload.");
				}

				const resolvedName =
					displayName.trim() || defaultDocumentAssetName(file);
				if (!resolvedName) {
					throw new Error("Document name is required.");
				}

				const createdAsset = await uploadDocumentAsset(
					{
						createAsset,
						extractPdfMetadata,
						generateUploadUrl,
					},
					{
						description: description.trim() || undefined,
						file,
						name: resolvedName,
					}
				);

				await replaceStaticBlueprint({
					assetId: createdAsset.assetId,
					blueprintId:
						blueprint.blueprintId as Id<"mortgageDocumentBlueprints">,
					description: description.trim() || undefined,
					displayName: resolvedName,
				});
			} else {
				if (!selectedTemplateId) {
					throw new Error("Choose a replacement template.");
				}

				await replaceTemplateBlueprint({
					blueprintId:
						blueprint.blueprintId as Id<"mortgageDocumentBlueprints">,
					description: description.trim() || undefined,
					displayName: displayName.trim() || undefined,
					templateId: selectedTemplateId as Id<"documentTemplates">,
				});
			}

			toast.success("Mortgage document blueprint replaced.");
			onOpenChange(false);
		} catch (replaceError) {
			setError(
				replaceError instanceof Error
					? replaceError.message
					: "Unable to replace mortgage document blueprint."
			);
		} finally {
			setSubmitting(false);
		}
	}

	const isStatic = blueprint
		? isStaticMortgageBlueprintClass(blueprint.class)
		: true;

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{blueprint
							? `Replace ${blueprint.displayName}`
							: "Replace document"}
					</DialogTitle>
					<DialogDescription className="sr-only">
						The current active blueprint will be archived and replaced with a
						new successor row.
					</DialogDescription>
				</DialogHeader>
				<form
					className="space-y-4"
					onSubmit={(event) => void handleSubmit(event)}
				>
					<div className="space-y-2">
						<Label htmlFor="mortgage-blueprint-display-name">
							Display name
						</Label>
						<Input
							id="mortgage-blueprint-display-name"
							onChange={(event) => setDisplayName(event.target.value)}
							placeholder="Document name"
							value={displayName}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="mortgage-blueprint-description">Description</Label>
						<Textarea
							id="mortgage-blueprint-description"
							onChange={(event) => setDescription(event.target.value)}
							rows={3}
							value={description}
						/>
					</div>

					{isStatic ? (
						<div className="space-y-2">
							<Label htmlFor="mortgage-blueprint-file">Replacement PDF</Label>
							<Input
								accept="application/pdf"
								id="mortgage-blueprint-file"
								key={fileInputKey}
								name="replacementFile"
								type="file"
							/>
						</div>
					) : (
						<div className="space-y-3">
							<div className="space-y-2">
								<Label>Replacement template</Label>
								<Select
									onValueChange={setSelectedTemplateId}
									value={selectedTemplateId}
								>
									<SelectTrigger>
										<SelectValue placeholder="Choose a published template" />
									</SelectTrigger>
									<SelectContent>
										{(attachableTemplates ?? []).map((template) => (
											<SelectItem
												key={template.templateId}
												value={template.templateId}
											>
												{template.name}
												{template.currentPublishedVersion
													? ` v${template.currentPublishedVersion}`
													: ""}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							{canReviewDocumentEngine && selectedTemplateId ? (
								<Button asChild size="sm" type="button" variant="outline">
									<Link
										params={{ templateId: selectedTemplateId }}
										search={EMPTY_ADMIN_DETAIL_SEARCH}
										to="/admin/document-engine/designer/$templateId"
									>
										Open designer
									</Link>
								</Button>
							) : null}
						</div>
					)}

					{error ? <p className="text-destructive text-sm">{error}</p> : null}

					<Button disabled={submitting} type="submit">
						{submitting ? "Replacing document" : "Replace document"}
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function MortgageOwnershipOverrideSection({
	canManageOwnershipOverrides,
	mortgageId,
}: {
	readonly canManageOwnershipOverrides: boolean;
	readonly mortgageId: Id<"mortgages">;
}) {
	const assignMortgageFractionsToFairLendMic = useMutation(
		api.admin.mortgages.ownership.assignMortgageFractionsToFairLendMic
	);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!canManageOwnershipOverrides) {
			return;
		}

		const form = event.currentTarget;
		const formData = new FormData(form);
		const rawTargetUnits = String(formData.get("targetUnits") ?? "").trim();
		const targetUnits = rawTargetUnits ? Number(rawTargetUnits) : undefined;
		const reason = String(formData.get("reason") ?? "").trim();

		if (targetUnits !== undefined && !Number.isSafeInteger(targetUnits)) {
			toast.error("Target fractions must be a whole number.");
			return;
		}
		if (reason.length < 12) {
			toast.error("Provide an override reason with at least 12 characters.");
			return;
		}

		try {
			const result = await assignMortgageFractionsToFairLendMic({
				mortgageId,
				reason,
				targetUnits,
			});
			toast.success(
				`MIC ownership set to ${result.micPositionUnits.toLocaleString("en-CA")} fractions across ${result.entriesPosted} ledger correction${result.entriesPosted === 1 ? "" : "s"}.`
			);
			form.reset();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Unable to assign mortgage ownership to the FairLend MIC."
			);
		}
	}

	return (
		<DetailSectionShell
			description="Admin-only ownership correction. Posts auditable mortgage ledger entries instead of patching balances directly."
			title="Ownership Override"
		>
			<form
				className="space-y-4"
				onSubmit={(event) => void handleSubmit(event)}
			>
				<div className="grid gap-4 md:grid-cols-[180px_1fr]">
					<div className="space-y-2">
						<Label htmlFor="mortgage-ownership-target-units">
							Target MIC fractions
						</Label>
						<Input
							defaultValue="10000"
							disabled={!canManageOwnershipOverrides}
							id="mortgage-ownership-target-units"
							inputMode="numeric"
							max={10_000}
							min={0}
							name="targetUnits"
							step={1}
							type="number"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="mortgage-ownership-reason">Reason</Label>
						<Textarea
							disabled={!canManageOwnershipOverrides}
							id="mortgage-ownership-reason"
							name="reason"
							placeholder="Explain why this ownership correction is required."
							rows={3}
						/>
					</div>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-muted-foreground text-xs">
						Assigns fractions to the configured FairLend MIC owner and records
						the correction in both the ownership ledger and audit journal.
					</p>
					<Button
						disabled={!canManageOwnershipOverrides}
						type="submit"
						variant="outline"
					>
						Assign to FairLend MIC
					</Button>
				</div>
			</form>
		</DetailSectionShell>
	);
}

function MortgageMicSaleAvailabilitySection({
	canManageOwnershipOverrides,
	micSaleAvailability,
	mortgageId,
}: {
	readonly canManageOwnershipOverrides: boolean;
	readonly micSaleAvailability:
		| NonNullable<MortgageDetailContext>["micSaleAvailability"]
		| undefined;
	readonly mortgageId: Id<"mortgages">;
}) {
	const setMicSaleAvailabilityOverride = useMutation(
		api.admin.mortgages.ownership.setMicSaleAvailabilityOverride
	);
	const clearMicSaleAvailabilityOverride = useMutation(
		api.admin.mortgages.ownership.clearMicSaleAvailabilityOverride
	);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!canManageOwnershipOverrides) {
			return;
		}

		const form = event.currentTarget;
		const formData = new FormData(form);
		const submitter = (event.nativeEvent as SubmitEvent).submitter;
		const intent =
			submitter instanceof HTMLButtonElement && submitter.value === "clear"
				? "clear"
				: "set";
		const reason = String(formData.get("reason") ?? "").trim();
		if (reason.length < 12) {
			toast.error(
				"Provide a sale availability reason with at least 12 characters."
			);
			return;
		}

		if (intent === "clear") {
			try {
				await clearMicSaleAvailabilityOverride({
					mortgageId,
					reason,
				});
				toast.success("MIC sale availability cap cleared.");
				form.reset();
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: "Unable to clear MIC sale availability."
				);
			}
			return;
		}

		const rawFractions = String(
			formData.get("availableFractions") ?? ""
		).trim();
		const parsedFractions = Number(rawFractions);
		const availableLedgerUnits = Math.round(
			parsedFractions * LEDGER_UNITS_PER_DECILE
		);

		if (
			!Number.isFinite(parsedFractions) ||
			parsedFractions < 0 ||
			parsedFractions > 10 ||
			!Number.isSafeInteger(availableLedgerUnits)
		) {
			toast.error("Available sale fractions must be a number from 0 to 10.");
			return;
		}

		try {
			const result = await setMicSaleAvailabilityOverride({
				availableLedgerUnits,
				mortgageId,
				reason,
			});
			toast.success(
				`MIC sale availability capped at ${formatLedgerUnitsAsMarketplaceFractions(result.capLedgerUnits)} fractions.`
			);
			form.reset();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Unable to update MIC sale availability."
			);
		}
	}

	return (
		<DetailSectionShell
			description="Controls how many FairLend MIC saleable fractions are offered without increasing ledger-held availability."
			title="Marketplace Availability"
		>
			<div className="space-y-5">
				<MetricGrid
					items={[
						{
							label: "Treasury Saleable",
							value: formatLedgerUnitsAsMarketplaceFractions(
								micSaleAvailability?.treasuryAvailableLedgerUnits
							),
						},
						{
							label: "MIC-held Saleable",
							value: formatLedgerUnitsAsMarketplaceFractions(
								micSaleAvailability?.micAvailableLedgerUnits
							),
						},
						{
							label: "Locked",
							value: formatLedgerUnitsAsMarketplaceFractions(
								micSaleAvailability?.lockedLedgerUnits
							),
						},
						{
							label: "Sold / Non-MIC Held",
							value: formatLedgerUnitsAsMarketplaceFractions(
								micSaleAvailability?.soldLedgerUnits
							),
						},
						{
							label: "Available For Sale",
							value: formatLedgerUnitsAsMarketplaceFractions(
								micSaleAvailability?.availableForSaleLedgerUnits
							),
						},
						{
							label: "Sale Cap",
							value: formatLedgerUnitsAsMarketplaceFractions(
								micSaleAvailability?.capLedgerUnits
							),
						},
						{
							label: "Canonical MIC Owner",
							value:
								micSaleAvailability?.canonicalMicLenderAuthId ?? "Unavailable",
						},
					]}
				/>
				<form
					className="space-y-4"
					onSubmit={(event) => void handleSubmit(event)}
				>
					<div className="grid gap-4 md:grid-cols-[180px_1fr]">
						<div className="space-y-2">
							<Label htmlFor="mortgage-mic-sale-available-fractions">
								Available for sale
							</Label>
							<Input
								defaultValue={
									micSaleAvailability?.capLedgerUnits == null
										? "10"
										: String(
												ledgerUnitsToDecilesExact(
													micSaleAvailability.capLedgerUnits
												)
											)
								}
								disabled={!canManageOwnershipOverrides}
								id="mortgage-mic-sale-available-fractions"
								inputMode="decimal"
								max={10}
								min={0}
								name="availableFractions"
								step={0.1}
								type="number"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="mortgage-mic-sale-reason">Reason</Label>
							<Textarea
								disabled={!canManageOwnershipOverrides}
								id="mortgage-mic-sale-reason"
								name="reason"
								placeholder="Explain why MIC sale availability is being changed."
								rows={3}
							/>
						</div>
					</div>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<p className="text-muted-foreground text-xs">
							Caps are checked again when a lender starts checkout.
						</p>
						<div className="flex gap-2">
							<Button
								disabled={
									!canManageOwnershipOverrides ||
									micSaleAvailability?.capLedgerUnits == null
								}
								name="intent"
								type="submit"
								value="clear"
								variant="outline"
							>
								Clear cap
							</Button>
							<Button
								disabled={!canManageOwnershipOverrides}
								name="intent"
								type="submit"
								value="set"
							>
								Save sale cap
							</Button>
						</div>
					</div>
				</form>
			</div>
		</DetailSectionShell>
	);
}

function MortgageMarketplaceVisibilitySection({
	canManageListingVisibility,
	listing,
}: {
	readonly canManageListingVisibility: boolean;
	readonly listing:
		| NonNullable<MortgageDetailContext>["listing"]
		| null
		| undefined;
}) {
	const publishListing = useMutation(
		api.admin.settings.mutations.publishListing
	);
	const hideListing = useMutation(api.admin.settings.mutations.hideListing);
	const [isSaving, setIsSaving] = useState(false);

	async function handleVisibilityChange(visible: boolean) {
		if (!(canManageListingVisibility && listing?.listingId)) {
			return;
		}

		setIsSaving(true);
		try {
			if (visible) {
				await publishListing({ listingId: listing.listingId });
				toast.success("Marketplace listing published.");
			} else {
				await hideListing({ listingId: listing.listingId });
				toast.success("Marketplace listing hidden.");
			}
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Unable to update marketplace visibility."
			);
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<DetailSectionShell
			description="Controls whether the mortgage-backed listing is visible in lender marketplace pages."
			title="Marketplace Visibility"
		>
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div className="space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<Badge
							variant={listing?.status === "published" ? "default" : "outline"}
						>
							{listing?.status === "published" ? "Visible" : "Hidden"}
						</Badge>
						{listing ? (
							<Badge variant="outline">{formatEnumLabel(listing.status)}</Badge>
						) : null}
					</div>
					<p className="text-muted-foreground text-sm">
						{listing
							? `Published ${formatDateTime(listing.publishedAt) ?? "not yet"}`
							: "No mortgage-backed listing projection exists yet."}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						disabled={
							!(canManageListingVisibility && listing) ||
							isSaving ||
							listing.status === "draft"
						}
						onClick={() => void handleVisibilityChange(false)}
						type="button"
						variant="outline"
					>
						Hide
					</Button>
					<Button
						disabled={
							!(canManageListingVisibility && listing) ||
							isSaving ||
							listing.status === "published"
						}
						onClick={() => void handleVisibilityChange(true)}
						type="button"
					>
						Publish
					</Button>
				</div>
			</div>
		</DetailSectionShell>
	);
}

function ListingProjectionSourceSection({
	detailContext,
	isRefreshingProjection,
	listingId,
	onRefreshProjection,
}: {
	readonly detailContext: ListingDetailContext | undefined;
	readonly isRefreshingProjection: boolean;
	readonly listingId: Id<"listings">;
	readonly onRefreshProjection: () => void;
}) {
	return (
		<ListingDetailSection
			description="Mortgage-backed listings are projector-owned for economics, property facts, appraisal summary, and public document compatibility. Only curated marketplace fields are editable here."
			title="Projection Source"
		>
			<div className="space-y-5">
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant="outline">
						{detailContext?.listing?.status ?? "draft"}
					</Badge>
					<Badge variant="outline">
						{detailContext?.listing?.dataSource === "mortgage_pipeline"
							? "Mortgage-backed projection"
							: "Listing record"}
					</Badge>
				</div>
				<ListingFactList
					items={[
						{
							label: "Linked Mortgage",
							value: detailContext?.mortgage ? (
								<Link
									className="text-primary underline-offset-4 hover:underline"
									params={{
										recordid: String(detailContext.mortgage.mortgageId),
									}}
									search={EMPTY_ADMIN_DETAIL_SEARCH}
									to="/admin/mortgages/$recordid"
								>
									{String(detailContext.mortgage.mortgageId)}
								</Link>
							) : (
								"Not linked"
							),
						},
						{
							label: "Projection Refreshed",
							value:
								formatDateTime(detailContext?.listing?.updatedAt) ??
								"Unavailable",
						},
						{
							label: "Linked Property",
							value: detailContext?.property ? (
								<Link
									className="text-primary underline-offset-4 hover:underline"
									params={{
										recordid: String(detailContext.property.propertyId),
									}}
									search={EMPTY_ADMIN_DETAIL_SEARCH}
									to="/admin/properties/$recordid"
								>
									{detailContext.property.streetAddress}
								</Link>
							) : (
								"Unavailable"
							),
						},
						{
							label: "Location",
							value: detailContext?.property
								? `${detailContext.property.city}, ${detailContext.property.province}`
								: "Unavailable",
						},
						{
							label: "Draft Title",
							value:
								detailContext?.listing?.title ??
								`${String(listingId)} (untitled listing)`,
						},
					]}
				/>
				<div className="flex flex-wrap gap-3">
					<Button
						disabled={
							isRefreshingProjection ||
							detailContext?.listing?.dataSource !== "mortgage_pipeline"
						}
						onClick={onRefreshProjection}
						type="button"
						variant="outline"
					>
						{isRefreshingProjection
							? "Refreshing projection"
							: "Refresh projection"}
					</Button>
				</div>
			</div>
		</ListingDetailSection>
	);
}

function ListingProjectedFactsSections({
	detailContext,
	record,
}: {
	readonly detailContext: ListingDetailContext | undefined;
	readonly record: UnifiedRecord;
}) {
	return (
		<div className="space-y-8">
			<ListingDetailSection
				description="Canonical mortgage economics projected onto the listing. These values refresh from the mortgage aggregate."
				title="Economics"
			>
				<ListingFactList
					items={[
						{
							label: "Principal",
							value: detailContext?.mortgage
								? formatCentsCurrency(detailContext.mortgage.principal)
								: "Unavailable",
						},
						{
							label: "Interest Rate",
							value:
								typeof detailContext?.mortgage?.interestRate === "number"
									? `${detailContext.mortgage.interestRate}%`
									: "Unavailable",
						},
						{
							label: "LTV",
							value:
								typeof record.fields.ltvRatio === "number"
									? `${record.fields.ltvRatio}%`
									: "Unavailable",
						},
						{
							label: "Payment Amount",
							value: detailContext?.mortgage
								? formatCentsCurrency(detailContext.mortgage.paymentAmount)
								: "Unavailable",
						},
						{
							label: "Payment Cadence",
							value: detailContext?.mortgage?.paymentFrequency
								? formatEnumLabel(detailContext.mortgage.paymentFrequency)
								: "Unavailable",
						},
						{
							label: "Maturity",
							value:
								formatDate(detailContext?.mortgage?.maturityDate) ??
								"Unavailable",
						},
					]}
				/>
			</ListingDetailSection>

			<ListingDetailSection
				description="Property facts are projection-owned and refresh from the canonical property record."
				title="Property Facts"
			>
				<ListingFactList
					items={[
						{
							label: "Address",
							value: detailContext?.property
								? `${detailContext.property.streetAddress}${detailContext.property.unit ? `, Unit ${detailContext.property.unit}` : ""}`
								: "Unavailable",
						},
						{
							label: "City",
							value: detailContext?.property?.city ?? "Unavailable",
						},
						{
							label: "Province",
							value: detailContext?.property?.province ?? "Unavailable",
						},
						{
							label: "Postal Code",
							value: detailContext?.property?.postalCode ?? "Unavailable",
						},
						{
							label: "Property Type",
							value: detailContext?.property?.propertyType
								? formatEnumLabel(detailContext.property.propertyType)
								: "Unavailable",
						},
						{
							label: "Coordinates",
							value:
								detailContext?.property?.latitude != null &&
								detailContext.property.longitude != null
									? `${detailContext.property.latitude}, ${detailContext.property.longitude}`
									: "Unavailable",
						},
					]}
				/>
			</ListingDetailSection>

			<ListingDetailSection
				description="Appraisal summary always comes from the latest canonical valuation snapshot."
				title="Appraisal Summary"
			>
				<ListingFactList
					items={[
						{
							label: "As-Is Value",
							value: detailContext?.latestValuationSnapshot
								? formatCentsCurrency(
										detailContext.latestValuationSnapshot.valueAsIs
									)
								: "Unavailable",
						},
						{
							label: "Valuation Date",
							value:
								detailContext?.latestValuationSnapshot?.valuationDate ??
								"Unavailable",
						},
						{
							label: "Source",
							value: detailContext?.latestValuationSnapshot?.source
								? formatEnumLabel(detailContext.latestValuationSnapshot.source)
								: "Unavailable",
						},
						{
							label: "Related Document Asset",
							value:
								detailContext?.latestValuationSnapshot
									?.relatedDocumentAssetId ?? "Not attached",
						},
					]}
				/>
			</ListingDetailSection>

			<ListingDetailSection
				description="Active public mortgage blueprints projected onto this listing for authenticated lender-facing reads."
				title="Public Documents"
			>
				{detailContext?.publicDocuments?.length ? (
					<CompactList
						emptyMessage="No public origination docs projected yet."
						items={detailContext.publicDocuments}
						renderItem={(item) => {
							const document = item as ListingPublicDocumentListItem;
							return (
								<div className="py-3" key={String(document.blueprintId)}>
									<div className="flex flex-wrap items-center justify-between gap-3">
										<div className="space-y-1">
											<p className="font-medium text-sm">
												{document.displayName}
											</p>
											<p className="text-muted-foreground text-sm">
												{document.description ?? "Public mortgage document"}
											</p>
										</div>
										{document.url ? (
											<Button asChild size="sm" type="button" variant="outline">
												<a href={document.url} rel="noreferrer" target="_blank">
													Open PDF
												</a>
											</Button>
										) : null}
									</div>
								</div>
							);
						}}
					/>
				) : (
					<EmptyContext message="No public origination docs projected yet." />
				)}
			</ListingDetailSection>
		</div>
	);
}

function ListingCurationFieldsSection({
	curationForm,
	isSavingCuration,
	onCurationFormChange,
	onSaveCuration,
}: {
	readonly curationForm: ListingCurationFormState;
	readonly isSavingCuration: boolean;
	readonly onCurationFormChange: Dispatch<
		SetStateAction<ListingCurationFormState>
	>;
	readonly onSaveCuration: () => void;
}) {
	return (
		<ListingDetailSection
			description="These marketplace fields remain listing-owned. Saving here never edits projected economics, property facts, appraisal summary, or public document compatibility."
			title="Curated Fields"
		>
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="listing-curation-title">Title</Label>
					<Input
						id="listing-curation-title"
						onChange={(event) =>
							onCurationFormChange((current) => ({
								...current,
								title: event.target.value,
							}))
						}
						value={curationForm.title}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="listing-curation-description">Description</Label>
					<Textarea
						id="listing-curation-description"
						onChange={(event) =>
							onCurationFormChange((current) => ({
								...current,
								description: event.target.value,
							}))
						}
						rows={4}
						value={curationForm.description}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="listing-curation-marketplace-copy">
						Marketplace copy
					</Label>
					<Textarea
						id="listing-curation-marketplace-copy"
						onChange={(event) =>
							onCurationFormChange((current) => ({
								...current,
								marketplaceCopy: event.target.value,
							}))
						}
						rows={5}
						value={curationForm.marketplaceCopy}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="listing-curation-hero-images">
						Hero image storage IDs
					</Label>
					<Textarea
						id="listing-curation-hero-images"
						onChange={(event) =>
							onCurationFormChange((current) => ({
								...current,
								heroImages: event.target.value,
							}))
						}
						placeholder="One _storage id per line"
						rows={4}
						value={curationForm.heroImages}
					/>
				</div>
				<div className="grid gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="listing-curation-display-order">
							Display order
						</Label>
						<Input
							id="listing-curation-display-order"
							onChange={(event) =>
								onCurationFormChange((current) => ({
									...current,
									displayOrder: event.target.value,
								}))
							}
							type="number"
							value={curationForm.displayOrder}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="listing-curation-seo-slug">SEO slug</Label>
						<Input
							id="listing-curation-seo-slug"
							onChange={(event) =>
								onCurationFormChange((current) => ({
									...current,
									seoSlug: event.target.value,
								}))
							}
							value={curationForm.seoSlug}
						/>
					</div>
				</div>
				<div className="flex items-center gap-3 border-border/60 border-y py-3">
					<Checkbox
						checked={curationForm.featured}
						id="listing-curation-featured"
						onCheckedChange={(checked) =>
							onCurationFormChange((current) => ({
								...current,
								featured: checked === true,
							}))
						}
					/>
					<div className="space-y-1">
						<Label htmlFor="listing-curation-featured">Featured listing</Label>
						<p className="text-muted-foreground text-sm">
							Merchandising only. Projection refreshes preserve this flag.
						</p>
					</div>
				</div>
				<div className="space-y-2">
					<Label htmlFor="listing-curation-admin-notes">Admin notes</Label>
					<Textarea
						id="listing-curation-admin-notes"
						onChange={(event) =>
							onCurationFormChange((current) => ({
								...current,
								adminNotes: event.target.value,
							}))
						}
						rows={4}
						value={curationForm.adminNotes}
					/>
				</div>
				<Button
					disabled={isSavingCuration}
					onClick={onSaveCuration}
					type="button"
				>
					{isSavingCuration ? "Saving curated fields" : "Save curated fields"}
				</Button>
			</div>
		</ListingDetailSection>
	);
}

export function ListingsDedicatedDetails({
	fields: _fields,
	objectDefs: _objectDefs,
	onNavigateRelation: _onNavigateRelation,
	record,
}: {
	readonly fields: readonly NormalizedFieldDefinition[];
	readonly objectDefs?: readonly Doc<"objectDefs">[];
	readonly onNavigateRelation?: (target: AdminRelationNavigationTarget) => void;
	readonly record: UnifiedRecord;
}) {
	const listingId = record._id as Id<"listings">;
	const detailContext = useQuery(
		api.crm.detailContextQueries.getListingDetailContext,
		{
			listingId,
		}
	);
	const refreshProjection = useMutation(
		api.listings.projection.refreshListingProjection
	);
	const updateListingCuration = useMutation(
		api.listings.curation.updateListingCuration
	);
	const [isRefreshingProjection, setIsRefreshingProjection] = useState(false);
	const [isSavingCuration, setIsSavingCuration] = useState(false);
	const listing = detailContext?.listing;
	const hydratedListingIdRef = useRef<Id<"listings"> | null>(null);
	const [curationForm, setCurationForm] = useState(() =>
		buildListingCurationFormState({
			adminNotes: null,
			description: null,
			displayOrder: null,
			featured: false,
			heroImages: [],
			marketplaceCopy: null,
			seoSlug: null,
			title: null,
		})
	);

	useEffect(() => {
		if (!listing) {
			return;
		}

		if (
			!shouldHydrateListingCurationForm(hydratedListingIdRef.current, listing)
		) {
			return;
		}

		// Keep in-progress edits stable across live-query refreshes for the same listing.
		hydratedListingIdRef.current = listing.listingId;
		setCurationForm(buildListingCurationFormState(listing));
	}, [listing]);

	async function handleRefreshProjection() {
		if (
			!detailContext?.listing ||
			detailContext.listing.dataSource !== "mortgage_pipeline"
		) {
			return;
		}

		setIsRefreshingProjection(true);
		try {
			await refreshProjection({ listingId });
			toast.success("Listing projection refreshed.");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to refresh the listing projection."
			);
		} finally {
			setIsRefreshingProjection(false);
		}
	}

	async function handleSaveCuration() {
		setIsSavingCuration(true);
		try {
			await updateListingCuration({
				listingId,
				patch: {
					adminNotes: curationForm.adminNotes,
					description: curationForm.description,
					displayOrder: parseDisplayOrder(curationForm.displayOrder),
					featured: curationForm.featured,
					heroImages: parseHeroImageStorageIds(curationForm.heroImages),
					marketplaceCopy: curationForm.marketplaceCopy,
					seoSlug: curationForm.seoSlug,
					title: curationForm.title,
				},
			});
			toast.success("Curated listing fields saved.");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to save listing curation."
			);
		} finally {
			setIsSavingCuration(false);
		}
	}

	return (
		<div className="space-y-8">
			<ListingProjectionSourceSection
				detailContext={detailContext}
				isRefreshingProjection={isRefreshingProjection}
				listingId={listingId}
				onRefreshProjection={() => void handleRefreshProjection()}
			/>

			<ListingCurationFieldsSection
				curationForm={curationForm}
				isSavingCuration={isSavingCuration}
				onCurationFormChange={setCurationForm}
				onSaveCuration={() => void handleSaveCuration()}
			/>

			<ListingProjectedFactsSections
				detailContext={detailContext}
				record={record}
			/>
		</div>
	);
}

export function DealsDedicatedDetails({
	fields,
	objectDefs,
	onNavigateRelation,
	record,
}: {
	readonly fields: readonly NormalizedFieldDefinition[];
	readonly objectDefs?: readonly Doc<"objectDefs">[];
	readonly onNavigateRelation?: (target: AdminRelationNavigationTarget) => void;
	readonly record: UnifiedRecord;
}) {
	const dealId = record._id as Id<"deals">;
	const canRetryPackage = useAuthorization({
		kind: "permission",
		permission: "deal:manage",
	}).allowed;
	const detailContext = useQuery(
		api.crm.detailContextQueries.getDealDetailContext,
		{
			dealId,
		}
	);
	const groupedDocumentInstances = groupDealDocumentInstances(
		detailContext?.documentInstances ?? []
	);
	const archivedSignedArtifactCount =
		groupedDocumentInstances.archivedSignableDocuments.filter(
			(document) =>
				Boolean(document.archivedSigning?.finalPdfUrl) ||
				Boolean(document.archivedSigning?.signingCompletedAt)
		).length;
	const lenderParty = detailContext?.parties?.lender ?? null;
	const sellerParty = detailContext?.parties?.seller ?? null;
	const lawyerParty = detailContext?.parties?.lawyer ?? null;
	const lenderPartyTarget = lenderParty?.lenderId
		? {
				entityType: "lenders",
				recordId: String(lenderParty.lenderId),
			}
		: lenderParty?.userId
			? {
					entityType: "users",
					recordId: String(lenderParty.userId),
				}
			: null;
	const sellerPartyTarget = sellerParty?.borrowerId
		? {
				entityType: "borrowers",
				recordId: String(sellerParty.borrowerId),
			}
		: sellerParty?.userId
			? {
					entityType: "users",
					recordId: String(sellerParty.userId),
				}
			: null;
	const lawyerPartyTarget = lawyerParty?.userId
		? {
				entityType: "users",
				recordId: String(lawyerParty.userId),
			}
		: null;
	const retryPackageGeneration = useAction(
		api.documents.dealPackages.retryPackageGeneration
	);
	const syncSignableDocumentEnvelope = useAction(
		api.documents.signature.webhooks.syncSignableDocumentEnvelope
	);
	const detailFields = filterDetailFields(fields, []);
	const packageStatus = detailContext?.documentPackage?.status ?? null;
	const canRetry =
		canRetryPackage &&
		(packageStatus === "failed" || packageStatus === "partial_failure");
	const retryKey = String(dealId);
	const isRetryingPackage = retryingDealPackageIds.has(retryKey);

	async function handleRetryPackageGeneration(
		event: React.MouseEvent<HTMLButtonElement>
	) {
		if (retryingDealPackageIds.has(retryKey)) {
			return;
		}

		const button = event.currentTarget;
		retryingDealPackageIds.add(retryKey);
		button.disabled = true;
		try {
			await retryPackageGeneration({ dealId });
			toast.success("Deal package generation retried.");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Unable to retry deal package generation."
			);
		} finally {
			retryingDealPackageIds.delete(retryKey);
			button.disabled = false;
		}
	}

	async function handleSyncSignableDocument(
		instanceId: Id<"dealDocumentInstances">
	) {
		try {
			await syncSignableDocumentEnvelope({ dealId, instanceId });
			toast.success("Signable document status refreshed.");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Unable to refresh signable document status."
			);
		}
	}

	return (
		<div className="space-y-6">
			<SectionedRecordDetails
				fields={detailFields}
				highlightFieldNames={["status", "closingDate", "fractionalShare"]}
				objectDefs={objectDefs}
				onNavigateRelation={onNavigateRelation}
				record={record}
				sections={[
					{
						title: "Summary",
						description:
							"Canonical deal terms and the immutable package header created at deal lock.",
						fieldNames: [
							"status",
							"closingDate",
							"fractionalShare",
							"lockingFeeAmount",
						],
					},
				]}
			/>

			<DealPortalLinks dealId={dealId} />

			<DetailSectionShell
				description="The package is created once on DEAL_LOCKED and retains immutable document-instance rows for deal-time distribution."
				title="Deal Package"
			>
				<div className="space-y-4">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="outline">
							{detailContext?.documentPackage?.status ?? "pending"}
						</Badge>
						{archivedSignedArtifactCount > 0 ? (
							<Badge variant="secondary">Signed archive ready</Badge>
						) : null}
						{groupedDocumentInstances.archivedSignableDocuments.length > 0 ? (
							<Badge variant="outline">Archived signables</Badge>
						) : null}
						{detailContext?.documentPackage?.lastError ? (
							<Badge variant="secondary">Last error recorded</Badge>
						) : null}
					</div>
					<MetricGrid
						items={[
							{
								label: "Package ID",
								value: detailContext?.documentPackage?.packageId
									? String(detailContext.documentPackage.packageId)
									: "Not created yet",
							},
							{
								label: "Retry Count",
								value: String(detailContext?.documentPackage?.retryCount ?? 0),
							},
							{
								label: "Ready At",
								value:
									formatDateTime(detailContext?.documentPackage?.readyAt) ??
									"Unavailable",
							},
							{
								label: "Archived At",
								value:
									formatDateTime(detailContext?.documentPackage?.archivedAt) ??
									"Unavailable",
							},
							{
								label: "Linked Mortgage",
								value: detailContext?.mortgage ? (
									<Link
										className="text-primary underline-offset-4 hover:underline"
										params={{
											recordid: String(detailContext.mortgage.mortgageId),
										}}
										search={EMPTY_ADMIN_DETAIL_SEARCH}
										to="/admin/mortgages/$recordid"
									>
										{String(detailContext.mortgage.mortgageId)}
									</Link>
								) : (
									"Unavailable"
								),
							},
							{
								label: "Linked Property",
								value: detailContext?.property ? (
									<Link
										className="text-primary underline-offset-4 hover:underline"
										params={{
											recordid: String(detailContext.property.propertyId),
										}}
										search={EMPTY_ADMIN_DETAIL_SEARCH}
										to="/admin/properties/$recordid"
									>
										{detailContext.property.streetAddress}
									</Link>
								) : (
									"Unavailable"
								),
							},
							{
								label: "Last Error",
								value: detailContext?.documentPackage?.lastError ?? "None",
							},
						]}
					/>
					{groupedDocumentInstances.archivedSignableDocuments.length > 0 ? (
						<div className="border-emerald-500/30 border-y bg-emerald-500/5 py-3">
							<p className="font-medium text-emerald-900 text-sm dark:text-emerald-100">
								Signed archive captured
							</p>
							<p className="mt-1 text-emerald-900/80 text-sm dark:text-emerald-100/80">
								Final executed PDFs and any completion certificates now flow
								through platform storage for CRM review.
							</p>
						</div>
					) : null}
					{canRetry ? (
						<Button
							disabled={isRetryingPackage}
							onClick={(event) => void handleRetryPackageGeneration(event)}
							type="button"
						>
							Retry all failed documents
						</Button>
					) : null}
				</div>
			</DetailSectionShell>

			<DetailSectionShell
				description="Immutable uploaded private package members frozen at deal lock. Failed retries archive the old instance and create a successor row."
				title="Private Static Documents"
			>
				<CompactList
					emptyMessage="No private static package documents exist yet."
					items={groupedDocumentInstances.privateStatic}
					renderItem={(item) => {
						const document = item as DealDocumentInstanceListItem;
						return (
							<div className="py-3" key={document.instanceId}>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="space-y-1">
										<p className="font-medium text-sm">
											{document.displayName}
										</p>
										<p className="text-muted-foreground text-sm">
											{document.packageLabel ?? "Deal package"} •{" "}
											{formatEnumLabel(document.status)}
										</p>
										{document.lastError ? (
											<p className="text-destructive text-sm">
												{document.lastError}
											</p>
										) : null}
									</div>
									{document.url ? (
										<Button asChild size="sm" type="button" variant="outline">
											<a href={document.url} rel="noreferrer" target="_blank">
												Open PDF
											</a>
										</Button>
									) : null}
								</div>
							</div>
						);
					}}
				/>
			</DetailSectionShell>

			<DetailSectionShell
				description="Generated non-signable template outputs materialized from the lock-time blueprint snapshot."
				title="Generated Read-only Documents"
			>
				<CompactList
					emptyMessage="No generated read-only documents exist yet."
					items={groupedDocumentInstances.generatedReadOnly}
					renderItem={(item) => {
						const document = item as DealDocumentInstanceListItem;
						return (
							<div className="space-y-2 py-3" key={document.instanceId}>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="space-y-1">
										<p className="font-medium text-sm">
											{document.displayName}
										</p>
										<p className="text-muted-foreground text-sm">
											{document.packageLabel ?? "Deal package"} •{" "}
											{formatEnumLabel(document.kind)} •{" "}
											{formatEnumLabel(document.status)}
										</p>
										{document.lastError ? (
											<p className="text-destructive text-sm">
												{document.lastError}
											</p>
										) : null}
									</div>
									{document.url ? (
										<Button asChild size="sm" type="button" variant="outline">
											<a href={document.url} rel="noreferrer" target="_blank">
												Open PDF
											</a>
										</Button>
									) : null}
								</div>
								<DocumentRemediationPanel
									document={document as DocumentRemediationPanelDocument}
								/>
							</div>
						);
					}}
				/>
			</DetailSectionShell>

			<DetailSectionShell
				description="Active provider-backed signable package members with envelope, recipient, and sync state."
				title="Signable Documents"
			>
				{groupedDocumentInstances.activeSignableDocuments.length > 0 ? (
					<CompactList
						emptyMessage="No signable package documents exist yet."
						items={groupedDocumentInstances.activeSignableDocuments}
						renderItem={(item) => {
							const document = item as DealDocumentInstanceListItem;
							return (
								<div className="space-y-3 py-3" key={document.instanceId}>
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div className="space-y-2">
											<div className="space-y-1">
												<p className="font-medium text-sm">
													{document.displayName}
												</p>
												<p className="text-muted-foreground text-sm">
													{document.packageLabel ?? "Deal package"} •{" "}
													{formatEnumLabel(document.status)}
												</p>
											</div>
											<div className="flex flex-wrap gap-2">
												<Badge variant={signingBadgeVariant(document.status)}>
													{formatEnumLabel(document.status)}
												</Badge>
												{document.signing?.status ? (
													<Badge
														variant={signingBadgeVariant(
															document.signing.status
														)}
													>
														{formatEnumLabel(document.signing.status)}
													</Badge>
												) : null}
												{document.signing?.generatedDocumentSigningStatus ? (
													<Badge
														variant={signingBadgeVariant(
															document.signing.generatedDocumentSigningStatus
														)}
													>
														{formatEnumLabel(
															document.signing.generatedDocumentSigningStatus
														)}
													</Badge>
												) : null}
											</div>
										</div>
										{document.signing?.envelopeId ? (
											<Button
												onClick={() =>
													void handleSyncSignableDocument(document.instanceId)
												}
												size="sm"
												type="button"
												variant="outline"
											>
												Refresh status
											</Button>
										) : null}
									</div>

									<div className="grid gap-2 text-muted-foreground text-sm sm:grid-cols-2">
										<p>
											Envelope status:{" "}
											{formatEnumLabel(
												document.signing?.status ??
													document.signing?.generatedDocumentSigningStatus ??
													"not_created"
											)}
										</p>
										<p>{describeSigningProgress(document.signing)}</p>
										<p>
											Provider envelope:{" "}
											{document.signing?.providerEnvelopeId ?? "Not created"}
										</p>
										<p>
											Last provider sync:{" "}
											{formatDateTime(
												document.signing?.lastProviderSyncAt ?? null
											) ?? "Not synced"}
										</p>
									</div>

									{document.signing?.recipients.length ? (
										<div className="flex flex-wrap gap-2">
											{document.signing.recipients.map((recipient) => (
												<div
													className="rounded-full border border-border/60 px-3 py-1 text-xs"
													key={`${document.instanceId}-${recipient.platformRole}`}
												>
													<span className="font-medium">{recipient.name}</span>
													<span className="text-muted-foreground">
														{" "}
														• {formatEnumLabel(recipient.status)}
													</span>
													<span className="text-muted-foreground">
														{" "}
														• {formatEnumLabel(recipient.providerRole)}
													</span>
												</div>
											))}
										</div>
									) : (
										<p className="text-muted-foreground text-sm">
											Recipient routing has not been resolved for this signable
											document yet.
										</p>
									)}

									{document.signing?.lastError || document.lastError ? (
										<p className="text-destructive text-sm">
											{document.signing?.lastError ?? document.lastError}
										</p>
									) : null}

									<DocumentRemediationPanel
										document={document as DocumentRemediationPanelDocument}
									/>
								</div>
							);
						}}
					/>
				) : (
					<EmptyContext
						message={
							groupedDocumentInstances.archivedSignableDocuments.length > 0
								? "All signable package documents are archived."
								: "No signable package documents exist yet."
						}
					/>
				)}
			</DetailSectionShell>

			<DetailSectionShell
				description="Archived signable package members retained for audit, regeneration, and post-close review."
				title="Archived Signable Documents"
			>
				<details className="group rounded-md border border-border/70 px-3">
					<summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium text-sm outline-none transition-colors hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
						<span className="flex min-w-0 flex-wrap items-center gap-2">
							<span>Show archived signable documents</span>
							<Badge variant="secondary">
								{groupedDocumentInstances.archivedSignableDocuments.length}
							</Badge>
						</span>
					</summary>
					<div className="pb-0">
						{groupedDocumentInstances.archivedSignableDocuments.length > 0 ? (
							<CompactList
								emptyMessage="No archived signable documents are available yet."
								items={groupedDocumentInstances.archivedSignableDocuments}
								renderItem={(item) => {
									const document = item as DealDocumentInstanceListItem;
									return (
										<div className="space-y-3 py-3" key={document.instanceId}>
											<div className="flex flex-wrap items-start justify-between gap-3">
												<div className="space-y-2">
													<div className="space-y-1">
														<p className="font-medium text-sm">
															{document.displayName}
														</p>
														<p className="text-muted-foreground text-sm">
															{document.packageLabel ?? "Deal package"} •{" "}
															{formatEnumLabel(document.status)}
														</p>
													</div>
													<div className="flex flex-wrap gap-2">
														<Badge
															variant={signingBadgeVariant(document.status)}
														>
															{formatEnumLabel(document.status)}
														</Badge>
														{document.signing?.status ? (
															<Badge
																variant={signingBadgeVariant(
																	document.signing.status
																)}
															>
																{formatEnumLabel(document.signing.status)}
															</Badge>
														) : null}
														{document.signing
															?.generatedDocumentSigningStatus ? (
															<Badge
																variant={signingBadgeVariant(
																	document.signing
																		.generatedDocumentSigningStatus
																)}
															>
																{formatEnumLabel(
																	document.signing
																		.generatedDocumentSigningStatus
																)}
															</Badge>
														) : null}
														{document.archivedSigning?.signingCompletedAt ? (
															<Badge variant="secondary">Signed</Badge>
														) : null}
													</div>
												</div>
												<div className="flex flex-wrap gap-2">
													{document.signing?.envelopeId ? (
														<Button
															onClick={() =>
																void handleSyncSignableDocument(
																	document.instanceId
																)
															}
															size="sm"
															type="button"
															variant="outline"
														>
															Refresh status
														</Button>
													) : null}
													{document.archivedSigning?.finalPdfUrl ? (
														<Button
															asChild
															size="sm"
															type="button"
															variant="outline"
														>
															<a
																href={document.archivedSigning.finalPdfUrl}
																rel="noreferrer"
																target="_blank"
															>
																Open final PDF
															</a>
														</Button>
													) : null}
													{document.archivedSigning
														?.completionCertificateUrl ? (
														<Button
															asChild
															size="sm"
															type="button"
															variant="outline"
														>
															<a
																href={
																	document.archivedSigning
																		.completionCertificateUrl
																}
																rel="noreferrer"
																target="_blank"
															>
																Open completion certificate
															</a>
														</Button>
													) : null}
												</div>
											</div>

											<div className="grid gap-2 text-muted-foreground text-sm sm:grid-cols-2">
												<p>
													Envelope status:{" "}
													{formatEnumLabel(
														document.signing?.status ??
															document.signing
																?.generatedDocumentSigningStatus ??
															"not_created"
													)}
												</p>
												<p>{describeSigningProgress(document.signing)}</p>
												<p>
													Provider envelope:{" "}
													{document.signing?.providerEnvelopeId ??
														"Not created"}
												</p>
												<p>
													Last provider sync:{" "}
													{formatDateTime(
														document.signing?.lastProviderSyncAt ?? null
													) ?? "Not synced"}
												</p>
											</div>

											{document.signing?.recipients.length ? (
												<div className="flex flex-wrap gap-2">
													{document.signing.recipients.map((recipient) => (
														<div
															className="rounded-full border border-border/60 px-3 py-1 text-xs"
															key={`${document.instanceId}-${recipient.platformRole}`}
														>
															<span className="font-medium">
																{recipient.name}
															</span>
															<span className="text-muted-foreground">
																{" "}
																• {formatEnumLabel(recipient.status)}
															</span>
															<span className="text-muted-foreground">
																{" "}
																• {formatEnumLabel(recipient.providerRole)}
															</span>
														</div>
													))}
												</div>
											) : (
												<p className="text-muted-foreground text-sm">
													Recipient routing has not been resolved for this
													signable document yet.
												</p>
											)}

											{document.signing?.lastError || document.lastError ? (
												<p className="text-destructive text-sm">
													{document.signing?.lastError ?? document.lastError}
												</p>
											) : null}

											<DocumentRemediationPanel
												document={document as DocumentRemediationPanelDocument}
											/>

											<div className="grid gap-2 text-muted-foreground text-sm sm:grid-cols-3">
												<p>
													Signed at:{" "}
													{formatDateTime(
														document.archivedSigning?.signingCompletedAt ?? null
													) ?? "Unavailable"}
												</p>
												<p>
													Archived at:{" "}
													{formatDateTime(document.archivedAt) ?? "Unavailable"}
												</p>
												<p>
													Certificate:{" "}
													{document.archivedSigning?.completionCertificateUrl
														? "Available"
														: "Not issued"}
												</p>
											</div>
										</div>
									);
								}}
							/>
						) : (
							<EmptyContext message="No archived signable documents are available yet." />
						)}
					</div>
				</details>
			</DetailSectionShell>

			<DetailSectionShell
				description="Deal participants resolved from canonical lender, seller, and lawyer references."
				title="Parties"
			>
				<MetricGrid
					items={[
						{
							label: "Lender",
							value: lenderParty ? (
								<PartyPreviewMetricValue
									label="lender"
									objectDefs={objectDefs}
									onNavigateRelation={onNavigateRelation}
									target={lenderPartyTarget}
								>
									{formatNamedPartyDisplay(lenderParty.name, lenderParty.email)}
								</PartyPreviewMetricValue>
							) : (
								"Unavailable"
							),
						},
						{
							label: "Seller",
							value: sellerParty ? (
								<PartyPreviewMetricValue
									label="seller"
									objectDefs={objectDefs}
									onNavigateRelation={onNavigateRelation}
									target={sellerPartyTarget}
								>
									{formatNamedPartyDisplay(sellerParty.name, sellerParty.email)}
								</PartyPreviewMetricValue>
							) : (
								"Unavailable"
							),
						},
						{
							label: "Lawyer",
							value: lawyerParty ? (
								<PartyPreviewMetricValue
									label="lawyer"
									objectDefs={objectDefs}
									onNavigateRelation={onNavigateRelation}
									target={lawyerPartyTarget}
								>
									{formatNamedPartyDisplay(lawyerParty.name, lawyerParty.email)}{" "}
									• {lawyerParty.lawyerType ?? "unknown"}
								</PartyPreviewMetricValue>
							) : (
								"Not assigned"
							),
						},
					]}
				/>
			</DetailSectionShell>

			<DetailSectionShell
				description="Recent deal state changes and package-related audit signals."
				title="Audit"
			>
				<CompactList
					emptyMessage="No recent audit events found."
					items={detailContext?.recentAuditEvents ?? []}
					renderItem={(item) => {
						const event =
							item as NonNullable<DealDetailContext>["recentAuditEvents"][number];
						return (
							<div className="py-3" key={event.eventId}>
								<p className="font-medium text-sm">{event.eventType}</p>
								<p className="text-muted-foreground text-sm">
									{event.previousState ?? "unknown"} →{" "}
									{event.newState ?? "unknown"} • {event.outcome}
								</p>
								<p className="text-muted-foreground text-xs">
									{formatDateTime(event.timestamp)}
								</p>
							</div>
						);
					}}
				/>
			</DetailSectionShell>
		</div>
	);
}

export function MortgagesDedicatedDetails({
	fields,
	objectDefs,
	onNavigateRelation,
	record,
}: {
	readonly fields: readonly NormalizedFieldDefinition[];
	readonly objectDefs?: readonly Doc<"objectDefs">[];
	readonly onNavigateRelation?: (target: AdminRelationNavigationTarget) => void;
	readonly record: UnifiedRecord;
}) {
	const mortgageId = record._id as Id<"mortgages">;
	const canManageMortgageDocuments = useAuthorization({
		kind: "permission",
		permission: "mortgage:originate",
	}).allowed;
	const canManagePaymentOperations = useAuthorization({
		kind: "permission",
		permission: "payment:manage",
	}).allowed;
	const canManageOwnershipOverrides = useAuthorization({
		kind: "permission",
		permission: "admin:access",
	}).allowed;
	const canManageListingVisibility = useAuthorization({
		kind: "permission",
		permission: "listing:manage",
	}).allowed;
	const detailContext = useQuery(
		api.crm.detailContextQueries.getMortgageDetailContext,
		{
			mortgageId,
		}
	);
	const retryCollectionsActivation = useAction(
		api.admin.origination.collections.retryCollectionsActivation
	);
	const syncExternalCollectionScheduleNow = useAction(
		api.payments.recurringSchedules.poller.syncExternalCollectionScheduleNow
	);
	const correctCollectionPlanEntryScheduledDate = useAction(
		api.payments.collectionPlan.admin.correctCollectionPlanEntryScheduledDate
	);
	const archiveMortgageBlueprint = useMutation(
		api.documents.mortgageBlueprints.archiveBlueprint
	);
	const detailFields = filterDetailFields(fields, ["propertyId"]);
	const paymentSetup = detailContext?.paymentSetup;
	const [blueprintToReplace, setBlueprintToReplace] =
		useState<MortgageDocumentListItem | null>(null);
	const [syncingExternalScheduleId, setSyncingExternalScheduleId] = useState<
		string | null
	>(null);
	const [editingPlanEntryId, setEditingPlanEntryId] = useState<string | null>(
		null
	);
	const [planEntryDateDraft, setPlanEntryDateDraft] = useState("");
	const [savingPlanEntryDateId, setSavingPlanEntryDateId] = useState<
		string | null
	>(null);
	const canRetryCollectionsActivation = Boolean(
		canManagePaymentOperations &&
			paymentSetup?.activationStatus === "failed" &&
			paymentSetup.originationCaseId &&
			paymentSetup.activationSelectedBankAccountId
	);

	async function handleRetryCollectionsActivation() {
		const caseId = detailContext?.paymentSetup?.originationCaseId;
		if (!caseId) {
			return;
		}

		try {
			const result = await retryCollectionsActivation({ caseId });
			if (result.status === "failed") {
				toast.error(result.message);
				return;
			}
			toast.success("Provider-managed activation retried.");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Unable to retry provider-managed activation."
			);
		}
	}

	async function handleSyncExternalSchedule(scheduleId: string) {
		setSyncingExternalScheduleId(scheduleId);
		try {
			const result = await syncExternalCollectionScheduleNow({
				scheduleId: scheduleId as Id<"externalCollectionSchedules">,
			});
			if (result.status === "failed" || result.status === "skipped") {
				toast.error(
					result.errorMessage ?? "External schedule sync did not run."
				);
				return;
			}
			toast.success(
				result.ingestedEventCount > 0
					? `External schedule synced. ${result.ingestedEventCount} occurrence${result.ingestedEventCount === 1 ? "" : "s"} ingested.`
					: "External schedule synced."
			);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Unable to sync external schedule."
			);
		} finally {
			setSyncingExternalScheduleId(null);
		}
	}

	function handleStartPlanEntryDateEdit(args: {
		planEntryId: string;
		scheduledDate: number;
	}) {
		setEditingPlanEntryId(args.planEntryId);
		setPlanEntryDateDraft(formatDateInputValue(args.scheduledDate));
	}

	async function handleCorrectPlanEntryDate(planEntryId: string) {
		const newScheduledDate = parseDateInputAtNoonUtc(planEntryDateDraft);
		if (newScheduledDate === null) {
			toast.error("Choose a valid scheduled date.");
			return;
		}

		setSavingPlanEntryDateId(planEntryId);
		try {
			const result = await correctCollectionPlanEntryScheduledDate({
				planEntryId: planEntryId as Id<"collectionPlanEntries">,
				newScheduledDate,
				reason:
					"Admin corrected provider schedule date from mortgage diagnostics.",
			});
			if (result.outcome === "rejected") {
				toast.error(result.reasonDetail);
				return;
			}
			toast.success("Plan entry schedule date updated.");
			setEditingPlanEntryId(null);
			setPlanEntryDateDraft("");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Unable to update plan entry date."
			);
		} finally {
			setSavingPlanEntryDateId(null);
		}
	}

	async function handleArchiveBlueprint(blueprintId: string) {
		try {
			await archiveMortgageBlueprint({
				blueprintId: blueprintId as Id<"mortgageDocumentBlueprints">,
			});
			toast.success("Mortgage document blueprint archived.");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Unable to archive mortgage document blueprint."
			);
		}
	}

	return (
		<>
			<MortgageBlueprintReplaceDialog
				blueprint={blueprintToReplace}
				onOpenChange={(open) => {
					if (!open) {
						setBlueprintToReplace(null);
					}
				}}
				open={blueprintToReplace !== null}
			/>
			<MortgagesDedicatedDetailsContent
				canManageListingVisibility={canManageListingVisibility}
				canManageMortgageDocuments={canManageMortgageDocuments}
				canManageOwnershipOverrides={canManageOwnershipOverrides}
				canRetryCollectionsActivation={canRetryCollectionsActivation}
				canSyncExternalSchedules={canManagePaymentOperations}
				detailContext={detailContext}
				detailFields={detailFields}
				editingPlanEntryId={editingPlanEntryId}
				objectDefs={objectDefs}
				onArchiveBlueprint={handleArchiveBlueprint}
				onCorrectPlanEntryDate={handleCorrectPlanEntryDate}
				onNavigateRelation={onNavigateRelation}
				onReplaceBlueprint={setBlueprintToReplace}
				onRetryCollectionsActivation={handleRetryCollectionsActivation}
				onStartPlanEntryDateEdit={handleStartPlanEntryDateEdit}
				onSyncExternalSchedule={handleSyncExternalSchedule}
				paymentSetup={paymentSetup}
				planEntryDateDraft={planEntryDateDraft}
				record={record}
				savingPlanEntryDateId={savingPlanEntryDateId}
				setEditingPlanEntryId={setEditingPlanEntryId}
				setPlanEntryDateDraft={setPlanEntryDateDraft}
				syncingExternalScheduleId={syncingExternalScheduleId}
			/>
		</>
	);
}

export function MortgagesDedicatedDetailsContent({
	canManageMortgageDocuments,
	canManageListingVisibility,
	canManageOwnershipOverrides,
	canSyncExternalSchedules,
	canRetryCollectionsActivation,
	detailContext,
	detailFields,
	onArchiveBlueprint,
	objectDefs,
	onNavigateRelation,
	onReplaceBlueprint,
	onCorrectPlanEntryDate,
	onRetryCollectionsActivation,
	onStartPlanEntryDateEdit,
	onSyncExternalSchedule,
	editingPlanEntryId,
	paymentSetup,
	planEntryDateDraft,
	record,
	savingPlanEntryDateId,
	setEditingPlanEntryId,
	setPlanEntryDateDraft,
	syncingExternalScheduleId,
}: {
	readonly canManageMortgageDocuments: boolean;
	readonly canManageListingVisibility: boolean;
	readonly canManageOwnershipOverrides: boolean;
	readonly canSyncExternalSchedules: boolean;
	readonly canRetryCollectionsActivation: boolean;
	readonly detailContext: MortgageDetailContext | undefined;
	readonly detailFields: readonly NormalizedFieldDefinition[];
	readonly onArchiveBlueprint: (blueprintId: string) => Promise<void>;
	readonly objectDefs?: readonly Doc<"objectDefs">[];
	readonly onNavigateRelation?: (target: AdminRelationNavigationTarget) => void;
	readonly onReplaceBlueprint: (document: MortgageDocumentListItem) => void;
	readonly onCorrectPlanEntryDate: (planEntryId: string) => Promise<void>;
	readonly onRetryCollectionsActivation: () => Promise<void>;
	readonly onStartPlanEntryDateEdit: (args: {
		planEntryId: string;
		scheduledDate: number;
	}) => void;
	readonly onSyncExternalSchedule: (scheduleId: string) => Promise<void>;
	readonly editingPlanEntryId: string | null;
	readonly paymentSetup: MortgageDetailContext["paymentSetup"] | undefined;
	readonly planEntryDateDraft: string;
	readonly record: UnifiedRecord;
	readonly savingPlanEntryDateId: string | null;
	readonly setEditingPlanEntryId: (planEntryId: string | null) => void;
	readonly setPlanEntryDateDraft: (value: string) => void;
	readonly syncingExternalScheduleId: string | null;
}) {
	const borrowers = detailContext?.borrowers ?? [];
	const documents = detailContext?.documents ?? [];
	const activeDeals = detailContext?.activeDeals ?? [];
	const obligations = paymentSetup?.obligations ?? [];
	const planEntries = paymentSetup?.collectionPlanEntries ?? [];
	const externalSchedules = paymentSetup?.externalSchedules ?? [];
	const selectedSchedule = paymentSetup?.externalSchedule ?? null;
	const paymentSnapshot = detailContext?.paymentSnapshot;
	const primaryBorrower = borrowers[0] ?? null;
	const nextPayment = obligations[0] ?? null;
	const currentPaymentStatus =
		paymentSnapshot?.mostRecentPaymentStatus ??
		nextPayment?.displayStatus ??
		nextPayment?.status ??
		"unknown";
	const nextPaymentStatus =
		paymentSnapshot?.nextUpcomingPaymentStatus ??
		nextPayment?.displayStatus ??
		nextPayment?.status ??
		"unknown";
	const documentStatusCounts = documents.reduce<Record<string, number>>(
		(counts, document) => {
			counts[document.status] = (counts[document.status] ?? 0) + 1;
			return counts;
		},
		{}
	);
	const obligationStatusCounts = obligations.reduce<Record<string, number>>(
		(counts, obligation) => {
			const status = obligation.displayStatus ?? obligation.status;
			counts[status] = (counts[status] ?? 0) + 1;
			return counts;
		},
		{}
	);
	const scheduleStatusCounts = externalSchedules.reduce<Record<string, number>>(
		(counts, schedule) => {
			counts[schedule.status] = (counts[schedule.status] ?? 0) + 1;
			return counts;
		},
		{}
	);
	const activeDocuments = documents.filter(
		(document) => document.status === "active"
	);
	const archivedDocuments = documents.filter(
		(document) => document.status !== "active"
	);
	const saleableFractions = formatLedgerUnitsAsMarketplaceFractions(
		detailContext?.micSaleAvailability?.availableForSaleLedgerUnits
	);
	const lockedFractions = formatLedgerUnitsAsMarketplaceFractions(
		detailContext?.micSaleAvailability?.lockedLedgerUnits
	);
	const soldFractions = formatLedgerUnitsAsMarketplaceFractions(
		detailContext?.micSaleAvailability?.soldLedgerUnits
	);
	const simplifiedMortgageDetailView = (
		<div className="space-y-8">
			<DetailSectionShell title="Mortgage">
				<div className="space-y-5">
					<EssentialGrid
						items={[
							{
								emphasis: true,
								label: "Principal",
								value:
									typeof record.fields.principal === "number" ||
									typeof record.fields.principal === "bigint"
										? formatCentsCurrency(record.fields.principal)
										: formatOptionalDisplayValue(record.fields.principal),
							},
							{
								label: "Status",
								value: record.fields.status
									? formatEnumLabel(String(record.fields.status))
									: "Unavailable",
							},
							{
								label: "Rate",
								value:
									typeof record.fields.interestRate === "number"
										? `${record.fields.interestRate}%`
										: formatOptionalDisplayValue(record.fields.interestRate),
							},
							{
								label: "Maturity",
								value: formatDate(
									record.fields.maturityDate as number | string | null
								),
							},
							{
								label: "Property",
								value: detailContext?.property ? (
									<Link
										className="text-primary underline-offset-4 hover:underline"
										params={{
											recordid: String(detailContext.property.propertyId),
										}}
										search={EMPTY_ADMIN_DETAIL_SEARCH}
										to="/admin/properties/$recordid"
									>
										{formatPropertyLabel(detailContext.property)}
									</Link>
								) : (
									"Not attached"
								),
							},
							{
								label: "Borrower",
								value: primaryBorrower ? (
									<Link
										className="text-primary underline-offset-4 hover:underline"
										params={{ recordid: String(primaryBorrower.borrowerId) }}
										search={EMPTY_ADMIN_DETAIL_SEARCH}
										to="/admin/borrowers/$recordid"
									>
										{primaryBorrower.name}
									</Link>
								) : (
									"No borrower"
								),
							},
							{
								label: "Borrower Rail",
								value: primaryBorrower?.rotessaCustomerReference
									? "Rotessa linked"
									: "No Rotessa link",
							},
							{
								label: "Borrowers",
								value: borrowers.length,
							},
						]}
					/>
					<Accordion collapsible type="single">
						<AccordionItem value="mortgage-record">
							<AccordionTrigger>All mortgage fields</AccordionTrigger>
							<AccordionContent>
								<SectionedRecordDetails
									fields={detailFields}
									highlightFieldNames={["principal", "status", "interestRate"]}
									objectDefs={objectDefs}
									onNavigateRelation={onNavigateRelation}
									record={record}
									sections={MORTGAGE_BASE_SECTIONS}
								/>
							</AccordionContent>
						</AccordionItem>
						<AccordionItem value="borrowers">
							<AccordionTrigger>Borrower details</AccordionTrigger>
							<AccordionContent>
								<CompactList
									emptyMessage="No borrower links found."
									items={borrowers}
									renderItem={(item) => {
										const borrower =
											item as NonNullable<MortgageDetailContext>["borrowers"][number];
										return (
											<div className="py-3" key={String(borrower.borrowerId)}>
												<div className="flex flex-wrap items-center gap-2">
													<Link
														className="font-medium text-primary text-sm underline-offset-4 hover:underline"
														params={{
															recordid: String(borrower.borrowerId),
														}}
														search={EMPTY_ADMIN_DETAIL_SEARCH}
														to="/admin/borrowers/$recordid"
													>
														{borrower.name}
													</Link>
													<Badge variant="outline">
														{formatEnumLabel(borrower.role)}
													</Badge>
													<Badge variant="outline">
														{formatEnumLabel(borrower.status)}
													</Badge>
												</div>
												<p className="mt-1 text-muted-foreground text-sm">
													{borrower.email ?? "No email"} •{" "}
													{borrower.authId ?? "No auth id"}
												</p>
												<p className="mt-1 text-muted-foreground text-xs">
													Rotessa{" "}
													{borrower.rotessaCustomerReference
														? [
																borrower.rotessaCustomerReference.customerId
																	? `ID ${borrower.rotessaCustomerReference.customerId}`
																	: null,
																borrower.rotessaCustomerReference
																	.customIdentifier,
															]
																.filter(Boolean)
																.join(" / ") || "linked"
														: "not linked"}
												</p>
											</div>
										);
									}}
								/>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				</div>
			</DetailSectionShell>

			<DetailSectionShell title="Market">
				<div className="space-y-5">
					<EssentialGrid
						items={[
							{
								label: "Listing",
								value: detailContext?.listing ? (
									<Link
										className="text-primary underline-offset-4 hover:underline"
										params={{
											recordid: String(detailContext.listing.listingId),
										}}
										search={EMPTY_ADMIN_DETAIL_SEARCH}
										to="/admin/listings/$recordid"
									>
										{detailContext.listing.title ??
											formatEnumLabel(detailContext.listing.status)}
									</Link>
								) : (
									"No active listing"
								),
							},
							{
								label: "Visibility",
								value: detailContext?.listing?.status
									? formatEnumLabel(detailContext.listing.status)
									: "Not projected",
							},
							{
								label: "LTV",
								value:
									typeof detailContext?.listing?.ltvRatio === "number"
										? `${detailContext.listing.ltvRatio}%`
										: "Unavailable",
							},
							{
								label: "Valuation",
								value: detailContext?.latestValuationSnapshot
									? formatCentsCurrency(
											detailContext.latestValuationSnapshot.valueAsIs
										)
									: "No valuation",
							},
							{
								label: "Saleable",
								value: saleableFractions,
							},
							{
								label: "Locked",
								value: lockedFractions,
							},
							{
								label: "Sold",
								value: soldFractions,
							},
							{
								label: "Active Deals",
								value: activeDeals.length,
							},
						]}
					/>
					<CompactTimeline
						items={[
							{
								date:
									formatDate(
										detailContext?.latestValuationSnapshot?.valuationDate
									) ?? "No date",
								label: "Valuation",
								meta: detailContext?.latestValuationSnapshot?.source
									? formatEnumLabel(
											detailContext.latestValuationSnapshot.source
										)
									: "No valuation source",
							},
							{
								date:
									formatDateTime(detailContext?.listing?.updatedAt) ??
									"No date",
								label: "Listing projection",
								meta: detailContext?.listing?.dataSource
									? formatEnumLabel(detailContext.listing.dataSource)
									: "No listing projection",
							},
						]}
					/>
					<Accordion collapsible type="single">
						<AccordionItem value="market-controls">
							<AccordionTrigger>Marketplace controls</AccordionTrigger>
							<AccordionContent className="space-y-5">
								<MortgageMarketplaceVisibilitySection
									canManageListingVisibility={canManageListingVisibility}
									listing={detailContext?.listing}
								/>
								<MortgageMicSaleAvailabilitySection
									canManageOwnershipOverrides={canManageOwnershipOverrides}
									micSaleAvailability={detailContext?.micSaleAvailability}
									mortgageId={record._id as Id<"mortgages">}
								/>
								<MortgageOwnershipOverrideSection
									canManageOwnershipOverrides={canManageOwnershipOverrides}
									mortgageId={record._id as Id<"mortgages">}
								/>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				</div>
			</DetailSectionShell>

			<DetailSectionShell title="Payments">
				<div className="space-y-5">
					<div className="flex flex-wrap gap-2">
						<Badge variant="outline">
							Now: {formatEnumLabel(currentPaymentStatus)}
						</Badge>
						<Badge variant="outline">
							Next: {formatEnumLabel(nextPaymentStatus)}
						</Badge>
						<Badge variant="outline">
							{paymentSetup?.collectionExecutionMode
								? formatEnumLabel(paymentSetup.collectionExecutionMode)
								: "Execution unknown"}
						</Badge>
						{selectedSchedule ? (
							<Badge variant="outline">
								Schedule {formatEnumLabel(selectedSchedule.status)}
							</Badge>
						) : null}
					</div>
					<EssentialGrid
						items={[
							{
								emphasis: true,
								label: "Most Recent",
								value:
									paymentSnapshot?.mostRecentPaymentAmount !== null
										? formatCurrency(
												paymentSnapshot?.mostRecentPaymentAmount ?? 0,
												100
											)
										: "None",
							},
							{
								label: "Most Recent Date",
								value:
									formatDateTime(paymentSnapshot?.mostRecentPaymentDate) ??
									"None",
							},
							{
								emphasis: true,
								label: "Next Due",
								value:
									paymentSnapshot?.nextUpcomingPaymentAmount !== null
										? formatCurrency(
												paymentSnapshot?.nextUpcomingPaymentAmount ?? 0,
												100
											)
										: "None",
							},
							{
								label: "Next Due Date",
								value:
									formatDateTime(paymentSnapshot?.nextUpcomingPaymentDate) ??
									"None",
							},
							{
								label: "Obligations",
								value: paymentSetup?.obligationCount ?? obligations.length,
							},
							{
								label: "Attempts",
								value: paymentSetup?.collectionAttemptCount ?? 0,
							},
							{
								label: "Transfers",
								value: paymentSetup?.transferRequestCount ?? 0,
							},
							{
								label: "Provider",
								value: paymentSetup?.collectionExecutionProviderCode
									? formatEnumLabel(
											paymentSetup.collectionExecutionProviderCode
										)
									: "App-owned",
							},
						]}
					/>
					<div className="grid gap-6 lg:grid-cols-2">
						<div className="space-y-2">
							<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
								Obligation status
							</p>
							<StatusDistribution
								segments={Object.entries(obligationStatusCounts).map(
									([label, count]) => ({
										className: getObligationStatusSegmentClass(label),
										count,
										label: formatEnumLabel(label),
									})
								)}
							/>
						</div>
						<div className="space-y-2">
							<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
								Schedule status
							</p>
							<StatusDistribution
								segments={Object.entries(scheduleStatusCounts).map(
									([label, count]) => ({
										className: getScheduleStatusSegmentClass(label),
										count,
										label: formatEnumLabel(label),
									})
								)}
							/>
						</div>
					</div>
					<CompactTimeline
						items={[
							{
								date:
									formatDateTime(paymentSnapshot?.mostRecentPaymentDate) ??
									"No date",
								label: "Most recent payment",
								meta:
									paymentSnapshot?.mostRecentPaymentAmount !== null
										? formatCurrency(
												paymentSnapshot?.mostRecentPaymentAmount ?? 0,
												100
											)
										: "No payment amount",
								status: (
									<Badge variant="outline">
										{formatEnumLabel(currentPaymentStatus)}
									</Badge>
								),
							},
							{
								date:
									formatDateTime(paymentSnapshot?.nextUpcomingPaymentDate) ??
									"No date",
								label: "Next upcoming payment",
								meta:
									paymentSnapshot?.nextUpcomingPaymentAmount !== null
										? formatCurrency(
												paymentSnapshot?.nextUpcomingPaymentAmount ?? 0,
												100
											)
										: "No payment amount",
								status: (
									<Badge variant="outline">
										{formatEnumLabel(nextPaymentStatus)}
									</Badge>
								),
							},
							{
								date:
									formatDateTime(selectedSchedule?.lastSyncedAt) ??
									"Not synced",
								label: "Provider sync",
								meta: selectedSchedule?.externalScheduleRef
									? `Rotessa ${selectedSchedule.externalScheduleRef}`
									: "No selected external schedule",
								status: selectedSchedule ? (
									<Badge variant="outline">
										{formatEnumLabel(selectedSchedule.status)}
									</Badge>
								) : null,
							},
						]}
					/>
					{paymentSetup?.activationStatus === "failed" ? (
						<div className="border-destructive/30 border-y bg-destructive/5 py-4 text-sm">
							<p className="font-medium text-destructive">
								Immediate Rotessa activation failed
							</p>
							<p className="mt-2 text-destructive/90 leading-6">
								{paymentSetup.activationLastError ??
									"Provider-managed activation failed after the mortgage committed."}
							</p>
							<Button
								className="mt-3"
								disabled={!canRetryCollectionsActivation}
								onClick={() => void onRetryCollectionsActivation()}
								type="button"
								variant="outline"
							>
								Retry activation
							</Button>
						</div>
					) : null}
					{detailContext?.paymentSetup?.scheduleRuleMissing ? (
						<div className="border-amber-500/30 border-y bg-amber-500/10 py-4 text-sm">
							<p className="font-medium text-amber-900">
								Schedule rule fallback applied
							</p>
							<p className="mt-2 text-amber-950/90 leading-6">
								No active collection schedule rule matched this mortgage at
								bootstrap time. FairLend created the initial app-owned plan
								entries using the default scheduling delay.
							</p>
						</div>
					) : null}
					<Accordion collapsible type="single">
						<AccordionItem value="payment-rows">
							<AccordionTrigger>
								Payment rows and provider tools
							</AccordionTrigger>
							<AccordionContent className="space-y-5">
								<div className="space-y-2">
									<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
										Obligations
									</p>
									{obligations.length ? (
										<div className="overflow-x-auto border-border/60 border-y">
											<table className="min-w-full text-left text-sm">
												<thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-[0.08em]">
													<tr>
														<th className="px-3 py-2 font-medium">#</th>
														<th className="px-3 py-2 font-medium">Status</th>
														<th className="px-3 py-2 font-medium">Due</th>
														<th className="px-3 py-2 font-medium">Amount</th>
														<th className="px-3 py-2 font-medium">Link</th>
													</tr>
												</thead>
												<tbody>
													{obligations.map((obligation) => (
														<tr
															className="border-border/50 border-t"
															key={String(obligation.obligationId)}
														>
															<td className="px-3 py-2 align-top">
																{obligation.paymentNumber}
															</td>
															<td className="px-3 py-2 align-top">
																<Badge variant="outline">
																	{formatEnumLabel(
																		obligation.displayStatus ??
																			obligation.status
																	)}
																</Badge>
															</td>
															<td className="px-3 py-2 align-top">
																{formatDate(obligation.dueDate) ??
																	"Unavailable"}
															</td>
															<td className="px-3 py-2 align-top">
																{formatCurrency(obligation.amount, 100)}
																<p className="text-muted-foreground text-xs">
																	Settled{" "}
																	{formatCurrency(
																		obligation.amountSettled,
																		100
																	)}
																</p>
															</td>
															<td className="px-3 py-2 align-top">
																<Link
																	className="text-primary text-xs underline-offset-4 hover:underline"
																	params={{
																		recordid: String(obligation.obligationId),
																	}}
																	search={EMPTY_ADMIN_DETAIL_SEARCH}
																	to="/admin/obligations/$recordid"
																>
																	Open obligation
																</Link>
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									) : (
										<EmptyContext message="No obligations found for this mortgage." />
									)}
								</div>
								<div className="space-y-2">
									<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
										External schedules
									</p>
									{externalSchedules.length ? (
										<div className="overflow-x-auto border-border/60 border-y">
											<table className="min-w-full text-left text-sm">
												<thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-[0.08em]">
													<tr>
														<th className="px-3 py-2 font-medium">Schedule</th>
														<th className="px-3 py-2 font-medium">Status</th>
														<th className="px-3 py-2 font-medium">Provider</th>
														<th className="px-3 py-2 font-medium">Last Sync</th>
														<th className="px-3 py-2 font-medium">Action</th>
													</tr>
												</thead>
												<tbody>
													{externalSchedules.map((schedule) => {
														const scheduleId = String(schedule.scheduleId);
														const isSyncing =
															syncingExternalScheduleId === scheduleId;
														return (
															<tr
																className="border-border/50 border-t"
																key={scheduleId}
															>
																<td className="px-3 py-2 align-top">
																	{schedule.externalScheduleRef ?? scheduleId}
																	{schedule.isSelected ? (
																		<p className="text-muted-foreground text-xs">
																			Selected
																		</p>
																	) : null}
																</td>
																<td className="px-3 py-2 align-top">
																	<Badge variant="outline">
																		{formatEnumLabel(schedule.status)}
																	</Badge>
																</td>
																<td className="px-3 py-2 align-top">
																	{formatEnumLabel(schedule.providerCode)}
																</td>
																<td className="px-3 py-2 align-top">
																	{formatDateTime(schedule.lastSyncedAt) ??
																		"Not synced"}
																	{schedule.lastSyncErrorMessage ? (
																		<p className="text-muted-foreground text-xs">
																			{schedule.lastSyncErrorMessage}
																		</p>
																	) : null}
																</td>
																<td className="px-3 py-2 align-top">
																	<Button
																		disabled={
																			!canSyncExternalSchedules ||
																			isSyncing ||
																			!schedule.externalScheduleRef
																		}
																		onClick={() =>
																			void onSyncExternalSchedule(scheduleId)
																		}
																		size="sm"
																		type="button"
																		variant="outline"
																	>
																		{isSyncing ? "Syncing" : "Sync now"}
																	</Button>
																</td>
															</tr>
														);
													})}
												</tbody>
											</table>
										</div>
									) : (
										<EmptyContext message="No external schedules found." />
									)}
								</div>
								<div className="space-y-2">
									<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
										Plan entries
									</p>
									{planEntries.length ? (
										<div className="overflow-x-auto border-border/60 border-y">
											<table className="min-w-full text-left text-sm">
												<tbody>
													{planEntries.map((entry) => {
														const planEntryId = String(entry.planEntryId);
														const isEditing =
															editingPlanEntryId === planEntryId;
														const isSaving =
															savingPlanEntryDateId === planEntryId;
														const canCorrectDate =
															canSyncExternalSchedules &&
															(entry.status === "planned" ||
																entry.status === "provider_scheduled");
														return (
															<tr
																className="border-border/50 border-t first:border-t-0"
																key={planEntryId}
															>
																<td className="px-3 py-2 align-top">
																	<Badge variant="outline">
																		{formatEnumLabel(entry.status)}
																	</Badge>
																	<p className="mt-1 text-muted-foreground text-xs">
																		{formatCurrency(entry.amount, 100)} •{" "}
																		{entry.obligationIds.length} obligation
																		{entry.obligationIds.length === 1
																			? ""
																			: "s"}
																	</p>
																</td>
																<td className="px-3 py-2 align-top">
																	{isEditing ? (
																		<Input
																			className="h-9 min-w-[9rem]"
																			onChange={(event) =>
																				setPlanEntryDateDraft(
																					event.currentTarget.value
																				)
																			}
																			type="date"
																			value={planEntryDateDraft}
																		/>
																	) : (
																		(formatDate(entry.scheduledDate) ??
																		"Unavailable")
																	)}
																</td>
																<td className="px-3 py-2 align-top">
																	{isEditing ? (
																		<div className="flex flex-wrap gap-2">
																			<Button
																				disabled={isSaving}
																				onClick={() =>
																					void onCorrectPlanEntryDate(
																						planEntryId
																					)
																				}
																				size="sm"
																				type="button"
																				variant="outline"
																			>
																				{isSaving ? "Saving" : "Save"}
																			</Button>
																			<Button
																				disabled={isSaving}
																				onClick={() => {
																					setEditingPlanEntryId(null);
																					setPlanEntryDateDraft("");
																				}}
																				size="sm"
																				type="button"
																				variant="ghost"
																			>
																				Cancel
																			</Button>
																		</div>
																	) : (
																		<Button
																			disabled={!canCorrectDate}
																			onClick={() =>
																				onStartPlanEntryDateEdit({
																					planEntryId,
																					scheduledDate: entry.scheduledDate,
																				})
																			}
																			size="sm"
																			type="button"
																			variant="outline"
																		>
																			Change date
																		</Button>
																	)}
																</td>
															</tr>
														);
													})}
												</tbody>
											</table>
										</div>
									) : (
										<EmptyContext message="No collection plan entries found." />
									)}
								</div>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				</div>
			</DetailSectionShell>

			<DetailSectionShell title="Fees">
				<div className="space-y-5">
					<EssentialGrid
						items={[
							{
								label: "Active Fees",
								value: detailContext?.fees?.activeFees.length ?? 0,
							},
							{
								emphasis: true,
								label: "Open Receivable",
								value: formatCurrency(
									detailContext?.fees?.openAccountsReceivableCents ?? 0,
									100
								),
							},
							{
								label: "Recent Assessments",
								value: detailContext?.fees?.recentAssessments.length ?? 0,
							},
						]}
					/>
					{detailContext?.fees?.activeFees.length ? (
						<div className="overflow-hidden rounded-md border border-border/70">
							<table className="w-full text-sm">
								<thead className="bg-muted/40 text-muted-foreground">
									<tr>
										<th className="px-3 py-2 text-left font-medium">Fee</th>
										<th className="px-3 py-2 text-left font-medium">
											Behavior
										</th>
										<th className="px-3 py-2 text-right font-medium">Value</th>
										<th className="px-3 py-2 text-right font-medium">Trace</th>
									</tr>
								</thead>
								<tbody>
									{detailContext.fees.activeFees.map((fee) => (
										<tr className="border-border/60 border-t" key={fee.feeId}>
											<td className="px-3 py-2">
												<div className="font-medium">{fee.displayCode}</div>
												<div className="text-muted-foreground text-xs">
													{formatEnumLabel(fee.defaultApplication)}
												</div>
											</td>
											<td className="px-3 py-2">
												{formatEnumLabel(fee.behavior)}
											</td>
											<td className="px-3 py-2 text-right">
												<FeeValue valueLabel={fee.valueLabel} />
											</td>
											<td className="px-3 py-2 text-right tabular-nums">
												{fee.traceCount}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<EmptyContext message="No active fees found for this mortgage." />
					)}
				</div>
			</DetailSectionShell>

			<DetailSectionShell title="Documents">
				<div className="space-y-5">
					<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
						<div className="space-y-3">
							<EssentialGrid
								items={[
									{ label: "Active", value: activeDocuments.length },
									{ label: "Archived", value: archivedDocuments.length },
									{ label: "Total", value: documents.length },
									{
										label: "With PDF",
										value: documents.filter((document) => document.asset?.url)
											.length,
									},
								]}
							/>
							<StatusDistribution
								segments={Object.entries(documentStatusCounts).map(
									([label, count]) => ({
										className:
											label === "active"
												? "bg-emerald-500"
												: "bg-muted-foreground",
										count,
										label: formatEnumLabel(label),
									})
								)}
							/>
						</div>
						<MortgagePackageApplyButton
							disabled={!canManageMortgageDocuments}
							mortgageId={record._id as Id<"mortgages">}
						/>
					</div>
					<CompactList
						emptyMessage="No mortgage document blueprints have been staged yet."
						items={documents}
						renderItem={(item) => {
							const document = item as MortgageDocumentListItem;
							return (
								<div className="py-3" key={String(document.blueprintId)}>
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div>
											<div className="flex flex-wrap items-center gap-2">
												<p className="font-medium text-sm">
													{document.displayName}
												</p>
												<Badge variant="outline">
													{formatEnumLabel(document.class)}
												</Badge>
												<Badge variant="secondary">
													{formatEnumLabel(document.status)}
												</Badge>
											</div>
											<p className="mt-1 text-muted-foreground text-xs">
												{document.packageLabel ?? "Standalone"} •{" "}
												{document.asset?.name ?? "Template-generated later"}
											</p>
											{document.description ? (
												<p className="mt-1 max-w-[56ch] text-muted-foreground text-xs leading-5">
													{document.description}
												</p>
											) : null}
										</div>
										<div className="flex flex-wrap gap-2">
											{document.asset?.url ? (
												<Button
													asChild
													size="sm"
													type="button"
													variant="outline"
												>
													<a
														href={document.asset.url}
														rel="noreferrer"
														target="_blank"
													>
														Open PDF
													</a>
												</Button>
											) : null}
											<Button
												disabled={
													!canManageMortgageDocuments ||
													document.status !== "active"
												}
												onClick={() => onReplaceBlueprint(document)}
												size="sm"
												type="button"
												variant="outline"
											>
												Replace
											</Button>
											<Button
												disabled={!canManageMortgageDocuments}
												onClick={() =>
													void onArchiveBlueprint(String(document.blueprintId))
												}
												size="sm"
												type="button"
												variant="ghost"
											>
												Archive
											</Button>
										</div>
									</div>
								</div>
							);
						}}
					/>
				</div>
			</DetailSectionShell>

			<DetailSectionShell title="Deals">
				<CompactList
					emptyMessage="No active deals are attached to this mortgage."
					items={activeDeals}
					renderItem={(item) => {
						const deal =
							item as NonNullable<MortgageDetailContext>["activeDeals"][number];
						return (
							<div className="py-3" key={String(deal.dealId)}>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="space-y-1">
										<Link
											className="font-medium text-primary text-sm underline-offset-4 hover:underline"
											params={{ recordid: String(deal.dealId) }}
											search={EMPTY_ADMIN_DETAIL_SEARCH}
											to="/admin/deals/$recordid"
										>
											Open deal
										</Link>
										<p className="text-muted-foreground text-sm">
											{formatEnumLabel(deal.status)} •{" "}
											{formatDecileCountForDisplay(
												ledgerUnitsToDecilesExact(deal.fractionalShare)
											)}{" "}
											fractions • {deal.lender?.name ?? deal.buyerId}
										</p>
									</div>
									<p className="text-muted-foreground text-sm">
										Closing {formatDateTime(deal.closingDate) ?? "not set"}
									</p>
								</div>
							</div>
						);
					}}
				/>
			</DetailSectionShell>
		</div>
	);
	if (record.nativeTable === "mortgages") {
		return simplifiedMortgageDetailView;
	}
	return (
		<div className="space-y-6">
			<SectionedRecordDetails
				fields={detailFields}
				highlightFieldNames={["principal", "status", "interestRate"]}
				objectDefs={objectDefs}
				onNavigateRelation={onNavigateRelation}
				record={record}
				sections={MORTGAGE_BASE_SECTIONS}
			/>

			<DetailSectionShell
				description="Canonical property attached to this mortgage."
				title="Property"
			>
				{detailContext?.property ? (
					<MetricGrid
						items={[
							{
								label: "Address",
								value: (
									<div className="space-y-1">
										<div>{`${detailContext.property.streetAddress}, ${detailContext.property.city}, ${detailContext.property.province}`}</div>
										<Link
											className="text-primary text-xs underline-offset-4 hover:underline"
											params={{
												recordid: String(detailContext.property.propertyId),
											}}
											search={EMPTY_ADMIN_DETAIL_SEARCH}
											to="/admin/properties/$recordid"
										>
											Open property record
										</Link>
									</div>
								),
							},
							{
								label: "Unit",
								value: detailContext.property.unit ?? "None",
							},
							{
								label: "Postal Code",
								value: detailContext.property.postalCode,
							},
							{
								label: "Type",
								value: formatEnumLabel(detailContext.property.propertyType),
							},
						]}
					/>
				) : (
					<EmptyContext message="No property context is attached to this mortgage." />
				)}
			</DetailSectionShell>

			<DetailSectionShell
				description="Canonical borrower relationships attached to this mortgage."
				title="Borrower(s)"
			>
				<div className="space-y-4">
					<CompactList
						emptyMessage="No borrower links found."
						items={detailContext?.borrowers ?? []}
						renderItem={(item) => {
							const borrower =
								item as NonNullable<MortgageDetailContext>["borrowers"][number];
							return (
								<div className="py-3" key={String(borrower.borrowerId)}>
									<Link
										className="font-medium text-primary text-sm underline-offset-4 hover:underline"
										params={{
											recordid: String(borrower.borrowerId),
										}}
										search={EMPTY_ADMIN_DETAIL_SEARCH}
										to="/admin/borrowers/$recordid"
									>
										{borrower.name}
									</Link>
									<div className="mt-2 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
										<div>
											<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
												Email
											</p>
											<p>{borrower.email ?? "Unavailable"}</p>
										</div>
										<div>
											<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
												Auth ID
											</p>
											<p className="break-all">
												{borrower.authId ?? "Unavailable"}
											</p>
										</div>
										<div>
											<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
												Role / Status
											</p>
											<p>
												{formatEnumLabel(borrower.role)} /{" "}
												{formatEnumLabel(borrower.status)}
												{borrower.idvStatus
													? ` / ${formatEnumLabel(borrower.idvStatus)}`
													: ""}
											</p>
										</div>
										<div>
											<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
												Rotessa Customer
											</p>
											<p>
												{borrower.rotessaCustomerReference
													? [
															borrower.rotessaCustomerReference.customerId
																? `ID ${borrower.rotessaCustomerReference.customerId}`
																: null,
															borrower.rotessaCustomerReference
																.customIdentifier,
														]
															.filter(Boolean)
															.join(" / ") || "Linked"
													: "Not linked"}
											</p>
										</div>
									</div>
									<div className="mt-3 grid gap-3 text-xs md:grid-cols-2">
										<div>
											<p className="text-muted-foreground uppercase tracking-[0.08em]">
												Linked External Schedules
											</p>
											<p className="mt-1">
												{borrower.linkedExternalSchedules.length > 0
													? borrower.linkedExternalSchedules
															.map((schedule) =>
																[
																	schedule.externalScheduleRef ??
																		String(schedule.scheduleId),
																	formatEnumLabel(schedule.status),
																	schedule.isSelected ? "selected" : null,
																]
																	.filter(Boolean)
																	.join(" / ")
															)
															.join("; ")
													: "None"}
											</p>
										</div>
										<div>
											<p className="text-muted-foreground uppercase tracking-[0.08em]">
												Linked Plan Entries
											</p>
											<p className="mt-1">
												{borrower.linkedPlanEntries.length > 0
													? borrower.linkedPlanEntries
															.map(
																(entry) =>
																	`${String(entry.planEntryId)} / ${formatEnumLabel(entry.status)} / ${formatDate(entry.displayDate ?? entry.scheduledDate) ?? "Unscheduled"}`
															)
															.join("; ")
													: "None"}
											</p>
										</div>
									</div>
								</div>
							);
						}}
					/>
				</div>
			</DetailSectionShell>

			<DetailSectionShell
				description="Listing projection and latest canonical valuation snapshot for this mortgage."
				title="Listing Projection"
			>
				<div className="space-y-4">
					{detailContext?.listing ? (
						<div className="py-4">
							<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
								<div className="space-y-2">
									<div className="flex flex-wrap items-center gap-2">
										<Badge variant="outline">
											{detailContext.listing.status}
										</Badge>
										<Badge variant="outline">
											{detailContext.listing.dataSource === "mortgage_pipeline"
												? "Mortgage-backed projection"
												: "Listing"}
										</Badge>
									</div>
									<p className="font-medium text-sm">
										{detailContext.listing.title ??
											`${detailContext.listing.status} listing`}
									</p>
									<p className="text-muted-foreground text-sm">
										Economics and property fields refresh from canonical
										mortgage, property, and valuation records.
									</p>
								</div>
								<Button asChild type="button" variant="outline">
									<Link
										params={{
											recordid: String(detailContext.listing.listingId),
										}}
										search={EMPTY_ADMIN_DETAIL_SEARCH}
										to="/admin/listings/$recordid"
									>
										Open listing
									</Link>
								</Button>
							</div>
						</div>
					) : null}
					<MetricGrid
						items={[
							{
								label: "Listing",
								value: detailContext?.listing ? (
									<Link
										className="text-primary underline-offset-4 hover:underline"
										params={{
											recordid: String(detailContext.listing.listingId),
										}}
										search={EMPTY_ADMIN_DETAIL_SEARCH}
										to="/admin/listings/$recordid"
									>
										{detailContext.listing.title ??
											`${detailContext.listing.status} listing`}
									</Link>
								) : (
									"No active listing"
								),
							},
							{
								label: "Listing Status",
								value: detailContext?.listing?.status ?? "Not projected",
							},
							{
								label: "Projection Refreshed",
								value:
									formatDateTime(detailContext?.listing?.updatedAt) ??
									"Unavailable",
							},
							{
								label: "Projected LTV",
								value:
									typeof detailContext?.listing?.ltvRatio === "number"
										? `${detailContext.listing.ltvRatio}%`
										: "Unavailable",
							},
							{
								label: "Valuation",
								value: detailContext?.latestValuationSnapshot
									? formatCentsCurrency(
											detailContext.latestValuationSnapshot.valueAsIs
										)
									: "No valuation snapshot",
							},
							{
								label: "Valuation Date",
								value:
									detailContext?.latestValuationSnapshot?.valuationDate ??
									"Unavailable",
							},
							{
								label: "Source",
								value: detailContext?.latestValuationSnapshot?.source
									? formatEnumLabel(
											detailContext.latestValuationSnapshot.source
										)
									: "Unavailable",
							},
							{
								label: "Document Asset",
								value:
									detailContext?.latestValuationSnapshot
										?.relatedDocumentAssetId ?? "Not attached",
							},
						]}
					/>
				</div>
			</DetailSectionShell>

			<DetailSectionShell
				description="Canonical payment bootstrap generated during origination. Provider-managed-now cases keep this mortgage committed while the follow-up Rotessa activation moves through pending, activating, active, or failed states."
				title="Payments/Obligations"
			>
				<div className="space-y-4">
					<PaymentSnapshotSection snapshot={detailContext?.paymentSnapshot} />
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="outline">
							{paymentSetup?.activationStatus
								? formatEnumLabel(paymentSetup.activationStatus)
								: "App-owned only"}
						</Badge>
						{paymentSetup?.externalSchedule ? (
							<Badge variant="outline">
								{formatEnumLabel(paymentSetup.externalSchedule.status)}
							</Badge>
						) : null}
					</div>
					{paymentSetup?.activationStatus === "failed" ? (
						<div className="border-destructive/30 border-y bg-destructive/5 py-4 text-sm">
							<p className="font-medium text-destructive">
								Immediate Rotessa activation failed
							</p>
							<p className="mt-2 text-destructive/90 leading-6">
								{paymentSetup.activationLastError ??
									"Provider-managed activation failed after the mortgage committed."}
							</p>
							<div className="mt-3 flex flex-wrap gap-3">
								<Button
									disabled={!canRetryCollectionsActivation}
									onClick={() => void onRetryCollectionsActivation()}
									type="button"
									variant="outline"
								>
									Retry activation
								</Button>
								{paymentSetup.activationSelectedBankAccountId ? null : (
									<p className="text-muted-foreground text-xs">
										Retry stays disabled until a primary borrower bank account
										is staged on the committed origination case.
									</p>
								)}
							</div>
						</div>
					) : null}
					{paymentSetup?.activationStatus === "activating" ? (
						<div className="border-sky-500/30 border-y bg-sky-500/10 py-4 text-sm">
							<p className="font-medium text-sky-900">
								Immediate Rotessa activation is in progress
							</p>
							<p className="mt-2 text-sky-950/90 leading-6">
								The mortgage is already committed. FairLend is finishing the
								provider-managed schedule handoff now.
							</p>
						</div>
					) : null}
					<MetricGrid
						items={[
							{
								label: "Activation Status",
								value: paymentSetup?.activationStatus
									? formatEnumLabel(paymentSetup.activationStatus)
									: "App-owned only",
							},
							{
								label: "Execution Mode",
								value: detailContext?.paymentSetup?.collectionExecutionMode
									? formatEnumLabel(
											detailContext.paymentSetup.collectionExecutionMode
										)
									: "Unavailable",
							},
							{
								label: "Provider",
								value: detailContext?.paymentSetup
									?.collectionExecutionProviderCode
									? formatEnumLabel(
											detailContext.paymentSetup.collectionExecutionProviderCode
										)
									: "App-owned only",
							},
							{
								label: "Last Attempt",
								value:
									formatDateTime(paymentSetup?.activationLastAttemptAt) ??
									"Not attempted",
							},
							{
								label: "Retry Count",
								value: paymentSetup?.activationRetryCount ?? 0,
							},
							{
								label: "Obligations",
								value:
									detailContext?.paymentSetup?.obligationCount ?? "Unavailable",
							},
							{
								label: "Plan Entries",
								value:
									detailContext?.paymentSetup?.collectionPlanEntryCount ??
									"Unavailable",
							},
							{
								label: "Collection Attempts",
								value:
									detailContext?.paymentSetup?.collectionAttemptCount ??
									"Unavailable",
							},
							{
								label: "Transfer Requests",
								value:
									detailContext?.paymentSetup?.transferRequestCount ??
									"Unavailable",
							},
							{
								label: "Selected Bank Account",
								value: paymentSetup?.activationSelectedBankAccountId
									? String(paymentSetup.activationSelectedBankAccountId)
									: "Not staged",
							},
						]}
					/>
					{paymentSetup?.externalSchedule ? (
						<div className="py-4">
							<div className="flex flex-wrap items-center gap-2">
								<p className="font-medium text-sm">
									Selected external schedule{" "}
									{String(paymentSetup.externalSchedule.scheduleId)}
								</p>
								<Badge variant="outline">
									{formatEnumLabel(paymentSetup.externalSchedule.status)}
								</Badge>
							</div>
							<div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
								<div>
									<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
										Provider Ref
									</p>
									<p className="mt-1 text-sm">
										{paymentSetup.externalSchedule.externalScheduleRef ??
											"Unavailable"}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
										Activated
									</p>
									<p className="mt-1 text-sm">
										{formatDateTime(
											paymentSetup.externalSchedule.activatedAt
										) ?? "Unavailable"}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
										Next Poll
									</p>
									<p className="mt-1 text-sm">
										{formatDateTime(paymentSetup.externalSchedule.nextPollAt) ??
											"Unavailable"}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
										Last Sync Error
									</p>
									<p className="mt-1 text-sm">
										{paymentSetup.externalSchedule.lastSyncErrorMessage ??
											"None"}
									</p>
								</div>
							</div>
						</div>
					) : null}
					{paymentSetup?.externalSchedules?.length ? (
						<div className="space-y-2">
							<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
								External Schedule Diagnostics
							</p>
							<div className="overflow-x-auto border-border/60 border-y">
								<table className="min-w-full text-left text-sm">
									<thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-[0.08em]">
										<tr>
											<th className="px-3 py-2 font-medium">Schedule</th>
											<th className="px-3 py-2 font-medium">Status</th>
											<th className="px-3 py-2 font-medium">Provider Ref</th>
											<th className="px-3 py-2 font-medium">Last Sync</th>
											<th className="px-3 py-2 font-medium">Sync Error</th>
											<th className="px-3 py-2 font-medium">Actions</th>
										</tr>
									</thead>
									<tbody>
										{paymentSetup.externalSchedules.map((schedule) => {
											const scheduleId = String(schedule.scheduleId);
											const isSyncing =
												syncingExternalScheduleId === scheduleId;
											return (
												<tr
													className="border-border/50 border-t"
													key={scheduleId}
												>
													<td className="px-3 py-2 align-top">
														<div>{scheduleId}</div>
														{schedule.isSelected ? (
															<p className="text-muted-foreground text-xs">
																Selected for headline diagnostics
															</p>
														) : null}
													</td>
													<td className="px-3 py-2 align-top">
														<Badge variant="outline">
															{formatEnumLabel(schedule.status)}
														</Badge>
													</td>
													<td className="px-3 py-2 align-top">
														{schedule.externalScheduleRef ?? "Unavailable"}
													</td>
													<td className="px-3 py-2 align-top">
														{formatDateTime(schedule.lastSyncedAt) ??
															"Not synced"}
													</td>
													<td className="px-3 py-2 align-top">
														{schedule.lastSyncErrorMessage ?? "None"}
													</td>
													<td className="px-3 py-2 align-top">
														<Button
															disabled={
																!canSyncExternalSchedules ||
																isSyncing ||
																!schedule.externalScheduleRef
															}
															onClick={() =>
																void onSyncExternalSchedule(scheduleId)
															}
															size="sm"
															type="button"
															variant="outline"
														>
															{isSyncing ? "Syncing" : "Sync now"}
														</Button>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>
					) : null}
					{detailContext?.paymentSetup?.scheduleRuleMissing ? (
						<div className="border-amber-500/30 border-y bg-amber-500/10 py-4 text-sm">
							<p className="font-medium text-amber-900">
								Schedule rule fallback applied
							</p>
							<p className="mt-2 text-amber-950/90 leading-6">
								No active collection schedule rule matched this mortgage at
								bootstrap time. FairLend still created the initial app-owned
								plan entries using the default scheduling delay.
							</p>
						</div>
					) : null}
					<div className="space-y-2">
						<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
							Obligations
						</p>
						{detailContext?.paymentSetup?.obligations?.length ? (
							<div className="overflow-x-auto border-border/60 border-y">
								<table className="min-w-full text-left text-sm">
									<thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-[0.08em]">
										<tr>
											<th className="px-3 py-2 font-medium">Payment #</th>
											<th className="px-3 py-2 font-medium">Type</th>
											<th className="px-3 py-2 font-medium">Status</th>
											<th className="px-3 py-2 font-medium">Due Date</th>
											<th className="px-3 py-2 font-medium">Amount</th>
										</tr>
									</thead>
									<tbody>
										{detailContext.paymentSetup.obligations.map(
											(obligation) => (
												<tr
													className="border-border/50 border-t"
													key={String(obligation.obligationId)}
												>
													<td className="px-3 py-2 align-top">
														<div className="space-y-1">
															<div>{obligation.paymentNumber}</div>
															<Link
																className="text-primary text-xs underline-offset-4 hover:underline"
																params={{
																	recordid: String(obligation.obligationId),
																}}
																search={EMPTY_ADMIN_DETAIL_SEARCH}
																to="/admin/obligations/$recordid"
															>
																Open obligation
															</Link>
														</div>
													</td>
													<td className="px-3 py-2 align-top">
														{formatEnumLabel(obligation.type)}
													</td>
													<td className="px-3 py-2 align-top">
														<div className="space-y-1">
															<Badge variant="outline">
																{formatEnumLabel(
																	obligation.displayStatus ?? obligation.status
																)}
															</Badge>
															{obligation.activeCollectionAttemptStatus ? (
																<p className="text-muted-foreground text-xs">
																	Collection{" "}
																	{formatEnumLabel(
																		obligation.activeTransferRequestStatus ??
																			obligation.activeCollectionAttemptStatus
																	)}
																</p>
															) : null}
														</div>
													</td>
													<td className="px-3 py-2 align-top">
														{formatDate(obligation.dueDate) ?? "Unavailable"}
													</td>
													<td className="px-3 py-2 align-top">
														<div>{formatCurrency(obligation.amount, 100)}</div>
														<p className="text-muted-foreground text-xs">
															Settled{" "}
															{formatCurrency(obligation.amountSettled, 100)}
														</p>
													</td>
												</tr>
											)
										)}
									</tbody>
								</table>
							</div>
						) : (
							<EmptyContext message="No obligations found for this mortgage." />
						)}
					</div>
					<div className="space-y-2">
						<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
							Plan Entries
						</p>
						{detailContext?.paymentSetup?.collectionPlanEntries?.length ? (
							<div className="overflow-x-auto border-border/60 border-y">
								<table className="min-w-full text-left text-sm">
									<thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-[0.08em]">
										<tr>
											<th className="px-3 py-2 font-medium">Plan Entry</th>
											<th className="px-3 py-2 font-medium">
												Plan Entry Status
											</th>
											<th className="px-3 py-2 font-medium">Execution</th>
											<th className="px-3 py-2 font-medium">Scheduled</th>
											<th className="px-3 py-2 font-medium">Amount</th>
											<th className="px-3 py-2 font-medium">Coverage</th>
											<th className="px-3 py-2 font-medium">Actions</th>
										</tr>
									</thead>
									<tbody>
										{detailContext.paymentSetup.collectionPlanEntries.map(
											(entry) => {
												const planEntryId = String(entry.planEntryId);
												const isEditing = editingPlanEntryId === planEntryId;
												const isSaving = savingPlanEntryDateId === planEntryId;
												const canCorrectDate =
													canSyncExternalSchedules &&
													(entry.status === "planned" ||
														entry.status === "provider_scheduled");
												return (
													<tr
														className="border-border/50 border-t"
														key={planEntryId}
													>
														<td className="px-3 py-2 align-top">
															<div className="space-y-1">
																<div>{planEntryId}</div>
																<p className="text-muted-foreground text-xs">
																	{formatEnumLabel(entry.source)}
																</p>
															</div>
														</td>
														<td className="px-3 py-2 align-top">
															<Badge variant="outline">
																{formatEnumLabel(entry.status)}
															</Badge>
														</td>
														<td className="px-3 py-2 align-top">
															{entry.executionMode
																? formatEnumLabel(entry.executionMode)
																: "Unavailable"}
														</td>
														<td className="px-3 py-2 align-top">
															{isEditing ? (
																<Input
																	className="h-9 min-w-[9rem]"
																	onChange={(event) =>
																		setPlanEntryDateDraft(
																			event.currentTarget.value
																		)
																	}
																	type="date"
																	value={planEntryDateDraft}
																/>
															) : (
																(formatDate(entry.scheduledDate) ??
																"Unavailable")
															)}
														</td>
														<td className="px-3 py-2 align-top">
															<div>{formatCurrency(entry.amount, 100)}</div>
															<p className="text-muted-foreground text-xs">
																{formatEnumLabel(entry.method)}
															</p>
														</td>
														<td className="px-3 py-2 align-top">
															{entry.obligationIds.length} obligation
															{entry.obligationIds.length === 1 ? "" : "s"}
														</td>
														<td className="px-3 py-2 align-top">
															{isEditing ? (
																<div className="flex flex-wrap gap-2">
																	<Button
																		disabled={isSaving}
																		onClick={() =>
																			void onCorrectPlanEntryDate(planEntryId)
																		}
																		size="sm"
																		type="button"
																		variant="outline"
																	>
																		{isSaving ? "Saving" : "Save"}
																	</Button>
																	<Button
																		disabled={isSaving}
																		onClick={() => {
																			setEditingPlanEntryId(null);
																			setPlanEntryDateDraft("");
																		}}
																		size="sm"
																		type="button"
																		variant="ghost"
																	>
																		Cancel
																	</Button>
																</div>
															) : (
																<Button
																	disabled={!canCorrectDate}
																	onClick={() =>
																		onStartPlanEntryDateEdit({
																			planEntryId,
																			scheduledDate: entry.scheduledDate,
																		})
																	}
																	size="sm"
																	type="button"
																	variant="outline"
																>
																	Change date
																</Button>
															)}
														</td>
													</tr>
												);
											}
										)}
									</tbody>
								</table>
							</div>
						) : (
							<EmptyContext message="No collection plan entries found for this mortgage." />
						)}
					</div>
				</div>
			</DetailSectionShell>

			<DetailSectionShell
				description="Marketplace visibility, saleable ownership, and manual ownership overrides."
				title="Ownership"
			>
				<div className="space-y-4">
					<MortgageMarketplaceVisibilitySection
						canManageListingVisibility={canManageListingVisibility}
						listing={detailContext?.listing}
					/>
					<MortgageMicSaleAvailabilitySection
						canManageOwnershipOverrides={canManageOwnershipOverrides}
						micSaleAvailability={detailContext?.micSaleAvailability}
						mortgageId={record._id as Id<"mortgages">}
					/>
					<MortgageOwnershipOverrideSection
						canManageOwnershipOverrides={canManageOwnershipOverrides}
						mortgageId={record._id as Id<"mortgages">}
					/>
				</div>
			</DetailSectionShell>

			<DetailSectionShell
				description="Mortgage-owned blueprint rows created during origination. Public static docs project onto the listing; private classes remain mortgage-owned until later deal-package phases."
				title="Documents"
			>
				<div className="mb-4 flex justify-end">
					<MortgagePackageApplyButton
						disabled={!canManageMortgageDocuments}
						mortgageId={record._id as Id<"mortgages">}
					/>
				</div>
				<CompactList
					emptyMessage="No mortgage document blueprints have been staged yet."
					items={detailContext?.documents ?? []}
					renderItem={(item) => {
						const document =
							item as NonNullable<MortgageDetailContext>["documents"][number];
						return (
							<div className="py-4" key={String(document.blueprintId)}>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="space-y-1">
										<div className="flex flex-wrap items-center gap-2">
											<p className="font-medium text-sm">
												{document.displayName}
											</p>
											<Badge variant="outline">
												{formatEnumLabel(document.class)}
											</Badge>
											<Badge variant="secondary">
												{formatEnumLabel(document.status)}
											</Badge>
										</div>
										<p className="text-muted-foreground text-sm">
											{document.description ?? "Mortgage document blueprint"}
										</p>
									</div>
									<div className="flex flex-wrap gap-2">
										{document.asset?.url ? (
											<Button asChild size="sm" type="button" variant="outline">
												<a
													href={document.asset.url}
													rel="noreferrer"
													target="_blank"
												>
													Open PDF
												</a>
											</Button>
										) : null}
										<Button
											disabled={
												!canManageMortgageDocuments ||
												document.status !== "active"
											}
											onClick={() => onReplaceBlueprint(document)}
											size="sm"
											type="button"
											variant="outline"
										>
											Replace
										</Button>
										<Button
											disabled={!canManageMortgageDocuments}
											onClick={() =>
												void onArchiveBlueprint(String(document.blueprintId))
											}
											size="sm"
											type="button"
											variant="ghost"
										>
											Archive
										</Button>
									</div>
								</div>
								<div className="mt-3 grid gap-3 text-muted-foreground text-xs md:grid-cols-2 xl:grid-cols-4">
									<div>
										<p className="uppercase tracking-[0.08em]">Package</p>
										<p className="mt-1">
											{document.packageLabel ?? "Standalone"}
										</p>
									</div>
									<div>
										<p className="uppercase tracking-[0.08em]">Template</p>
										<p className="mt-1">
											{document.templateName
												? `${document.templateName}${
														document.templateVersion
															? ` v${document.templateVersion}`
															: ""
													}`
												: "Static asset"}
										</p>
									</div>
									<div>
										<p className="uppercase tracking-[0.08em]">Asset</p>
										<p className="mt-1">
											{document.asset?.name ?? "Template-generated later"}
										</p>
									</div>
									<div>
										<p className="uppercase tracking-[0.08em]">Archived</p>
										<p className="mt-1">
											{formatDateTime(document.archivedAt) ?? "Active"}
										</p>
									</div>
								</div>
							</div>
						);
					}}
				/>
			</DetailSectionShell>

			<DetailSectionShell
				description="Open marketplace and closing activity attached to this mortgage."
				title="Active Deals"
			>
				<CompactList
					emptyMessage="No active deals are attached to this mortgage."
					items={detailContext?.activeDeals ?? []}
					renderItem={(item) => {
						const deal =
							item as NonNullable<MortgageDetailContext>["activeDeals"][number];
						return (
							<div className="py-3" key={String(deal.dealId)}>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="space-y-1">
										<Link
											className="font-medium text-primary text-sm underline-offset-4 hover:underline"
											params={{
												recordid: String(deal.dealId),
											}}
											search={EMPTY_ADMIN_DETAIL_SEARCH}
											to="/admin/deals/$recordid"
										>
											Open deal
										</Link>
										<p className="text-muted-foreground text-sm">
											{formatEnumLabel(deal.status)} •{" "}
											{formatDecileCountForDisplay(
												ledgerUnitsToDecilesExact(deal.fractionalShare)
											)}{" "}
											fractions • {deal.lender?.name ?? deal.buyerId}
										</p>
									</div>
									<p className="text-muted-foreground text-sm">
										Closing {formatDateTime(deal.closingDate) ?? "not set"}
									</p>
								</div>
							</div>
						);
					}}
				/>
			</DetailSectionShell>
		</div>
	);
}

export function ObligationsDedicatedDetails({
	fields,
	objectDefs,
	onNavigateRelation,
	record,
}: {
	readonly fields: readonly NormalizedFieldDefinition[];
	readonly objectDefs?: readonly Doc<"objectDefs">[];
	readonly onNavigateRelation?: (target: AdminRelationNavigationTarget) => void;
	readonly record: UnifiedRecord;
}) {
	const obligationId = record._id as Id<"obligations">;
	const detailContext = useQuery(
		api.crm.detailContextQueries.getObligationDetailContext,
		{
			obligationId,
		}
	);
	const obligationBalance = useQuery(
		api.payments.cashLedger.queries.getObligationBalance,
		{
			obligationId,
		}
	);
	const history = useQuery(
		api.payments.cashLedger.queries.getObligationHistory,
		{
			obligationId,
		}
	);
	const detailFields = filterDetailFields(fields, ["mortgageId", "borrowerId"]);

	return (
		<div className="space-y-6">
			<SectionedRecordDetails
				fields={detailFields}
				highlightFieldNames={[
					"mortgageSummary",
					"borrowerSummary",
					"amount",
					"paymentProgressSummary",
				]}
				objectDefs={objectDefs}
				onNavigateRelation={onNavigateRelation}
				record={record}
				sections={OBLIGATION_BASE_SECTIONS}
			/>

			<DetailSectionShell
				description="Balance, corrective obligations, and counterparties for this payment obligation."
				title="Settlement Context"
			>
				<div className="space-y-4">
					{obligationBalance ? (
						<MetricGrid
							items={[
								{
									label: "Outstanding",
									value: formatCurrency(
										obligationBalance.outstandingBalance,
										100
									),
								},
								{
									label: "Projected Settled",
									value: formatCurrency(
										obligationBalance.projectedSettledAmount,
										100
									),
								},
								{
									label: "Journal Settled",
									value: formatCurrency(
										obligationBalance.journalSettledAmount,
										100
									),
								},
							]}
						/>
					) : null}
					{detailContext ? (
						<MetricGrid
							items={[
								{
									label: "Mortgage",
									value:
										detailContext.mortgage.property?.streetAddress ??
										"Mortgage context loaded",
								},
								{
									label: "Borrower",
									value: detailContext.borrower.name,
								},
								{
									label: "Borrower Email",
									value: detailContext.borrower.email ?? "Unavailable",
								},
							]}
						/>
					) : null}
					<div>
						<p className="mb-2 text-muted-foreground text-xs uppercase tracking-[0.08em]">
							Corrective Obligations
						</p>
						<CompactList
							emptyMessage="No corrective obligations are linked to this payment."
							items={detailContext?.correctiveObligations ?? []}
							renderItem={(item) => {
								const corrective = item as NonNullable<
									typeof detailContext
								>["correctiveObligations"][number];
								return (
									<div
										className="flex items-center justify-between py-3"
										key={String(corrective.obligationId)}
									>
										<div>
											<p className="font-medium text-sm">{corrective.type}</p>
											<p className="text-muted-foreground text-sm">
												{corrective.status} • {formatDate(corrective.dueDate)}
											</p>
										</div>
										<Badge variant="outline">
											{formatCurrency(corrective.amount, 100)}
										</Badge>
									</div>
								);
							}}
						/>
					</div>
				</div>
			</DetailSectionShell>

			<DetailSectionShell
				description="Recent balance-affecting entries and obligation-specific audit events."
				title="Recent Activity"
			>
				<CompactList
					emptyMessage="No recent activity is available for this obligation."
					items={[
						...(detailContext?.recentAuditEvents ?? []).map((event) => ({
							id: event.eventId,
							title: event.eventType,
							subtitle: `${event.outcome} • ${new Date(event.timestamp).toLocaleString()}`,
						})),
						...(history ?? []).map((entry) => ({
							id: String(entry._id),
							title: entry.entryType,
							subtitle: `${new Date(entry.timestamp).toLocaleString()} • ${formatCurrency(entry.amount, 100)}`,
						})),
					].slice(0, 8)}
					renderItem={(item, index) => {
						const activity = item as {
							id: string;
							title: string;
							subtitle: string;
						};
						return (
							<div className="py-3" key={`${activity.id}-${String(index)}`}>
								<p className="font-medium text-sm">{activity.title}</p>
								<p className="text-muted-foreground text-sm">
									{activity.subtitle}
								</p>
							</div>
						);
					}}
				/>
			</DetailSectionShell>
		</div>
	);
}

export function BorrowersDedicatedDetails({
	fields,
	objectDefs,
	onNavigateRelation,
	record,
}: {
	readonly fields: readonly NormalizedFieldDefinition[];
	readonly objectDefs?: readonly Doc<"objectDefs">[];
	readonly onNavigateRelation?: (target: AdminRelationNavigationTarget) => void;
	readonly record: UnifiedRecord;
}) {
	const borrowerId = record._id as Id<"borrowers">;
	const detailContext = useQuery(
		api.crm.detailContextQueries.getBorrowerDetailContext,
		{
			borrowerId,
		}
	);
	const borrowerBalance = useQuery(
		api.payments.cashLedger.queries.getBorrowerBalance,
		{
			borrowerId,
		}
	);
	const detailFields = filterDetailFields(fields, ["userId"]);
	const relatedGroups: RelatedEntityGroup[] = [
		{
			description:
				"All mortgage records linked to this borrower, including the broker of record and any projected listing.",
			emptyMessage: "No mortgage participation was found.",
			items: (detailContext?.mortgages ?? []).map((mortgage) => ({
				badges: mortgage.listing
					? [formatEnumLabel(mortgage.listing.status)]
					: [],
				id: String(mortgage.mortgageId),
				label:
					formatPropertyLabel(mortgage.property) ??
					`Mortgage ${String(mortgage.mortgageId)}`,
				metadata: [
					formatEnumLabel(mortgage.role),
					formatEnumLabel(mortgage.status),
					formatCentsCurrency(mortgage.principal),
					mortgage.broker
						? `Broker: ${mortgage.broker.brokerageName ?? mortgage.broker.name}`
						: null,
				]
					.filter(Boolean)
					.join(" • "),
				searchText: [
					mortgage.property?.streetAddress,
					mortgage.property?.city,
					mortgage.property?.province,
					mortgage.listing?.title,
					mortgage.broker?.name,
					mortgage.broker?.brokerageName,
				]
					.filter(Boolean)
					.join(" "),
				target: {
					entityType: "mortgages",
					recordId: String(mortgage.mortgageId),
				},
			})),
			searchPlaceholder: "Search linked mortgages",
			title: "Mortgages",
		},
		{
			description:
				"Broker relationships inferred from the borrower's linked mortgages.",
			emptyMessage: "No broker connections were found.",
			items: (detailContext?.brokers ?? []).map((broker) => ({
				badges: [formatEnumLabel(broker.status)],
				id: String(broker.brokerId),
				label: broker.brokerageName ?? broker.name,
				metadata: [
					broker.brokerageName ? broker.name : null,
					broker.email ?? null,
					`${broker.mortgageCount} mortgage${broker.mortgageCount === 1 ? "" : "s"}`,
				]
					.filter(Boolean)
					.join(" • "),
				searchText: [broker.name, broker.email, broker.brokerageName]
					.filter(Boolean)
					.join(" "),
				target: {
					entityType: "brokers",
					recordId: String(broker.brokerId),
				},
			})),
			searchPlaceholder: "Search connected brokers",
			title: "Brokers",
		},
		{
			description:
				"Deal activity attached to this borrower's mortgage positions.",
			emptyMessage: "No connected deals were found.",
			items: (detailContext?.deals ?? []).map((deal) => ({
				badges: [formatEnumLabel(deal.status)],
				id: String(deal.dealId),
				label: `Deal ${String(deal.dealId)}`,
				metadata: [
					formatPropertyLabel(deal.property) ??
						`Mortgage ${String(deal.mortgageId)}`,
					deal.closingDate
						? formatDateTime(deal.closingDate)
						: "Closing date TBD",
					deal.lender ? `Lender: ${deal.lender.name}` : null,
				]
					.filter(Boolean)
					.join(" • "),
				searchText: [
					deal.lender?.name,
					deal.lender?.email,
					deal.property?.streetAddress,
					deal.property?.city,
					deal.property?.province,
				]
					.filter(Boolean)
					.join(" "),
				target: {
					entityType: "deals",
					recordId: String(deal.dealId),
				},
			})),
			searchPlaceholder: "Search connected deals",
			title: "Deals",
		},
	];

	return (
		<div className="space-y-6">
			<SectionedRecordDetails
				fields={detailFields}
				highlightFieldNames={[
					"borrowerName",
					"status",
					"idvStatus",
					"verificationSummary",
				]}
				objectDefs={objectDefs}
				onNavigateRelation={onNavigateRelation}
				record={record}
				sections={BORROWER_BASE_SECTIONS}
			/>

			<DetailSectionShell
				description="Profile, mortgage participation, and receivable context for the borrower."
				title="Portfolio Context"
			>
				<div className="space-y-4">
					{detailContext?.profile ? (
						<MetricGrid
							items={[
								{
									label: "Email",
									value: detailContext.profile.email ?? "Unavailable",
								},
								{
									label: "Onboarded",
									value:
										formatDate(detailContext.profile.onboardedAt) ?? "Not set",
								},
								{
									label: "Outstanding Receivable",
									value: borrowerBalance
										? formatCurrency(borrowerBalance.total, 100)
										: "Loading",
								},
							]}
						/>
					) : null}
					<RelatedEntityExplorer
						groups={relatedGroups}
						objectDefs={objectDefs}
						onNavigateRelation={onNavigateRelation}
					/>
				</div>
			</DetailSectionShell>

			<DetailSectionShell
				description="Recent borrower audit events from the state machine journal."
				title="Recent Audit Events"
			>
				<CompactList
					emptyMessage="No recent borrower audit events were found."
					items={detailContext?.recentAuditEvents ?? []}
					renderItem={(item) => {
						const event = item as NonNullable<
							typeof detailContext
						>["recentAuditEvents"][number];
						return (
							<div className="py-3" key={event.eventId}>
								<p className="font-medium text-sm">{event.eventType}</p>
								<p className="text-muted-foreground text-sm">
									{new Date(event.timestamp).toLocaleString()} • {event.outcome}
									{event.previousState && event.newState
										? ` • ${event.previousState} -> ${event.newState}`
										: ""}
								</p>
							</div>
						);
					}}
				/>
			</DetailSectionShell>
		</div>
	);
}

export function LendersDedicatedDetails({
	fields,
	objectDefs,
	onNavigateRelation,
	record,
}: {
	readonly fields: readonly NormalizedFieldDefinition[];
	readonly objectDefs?: readonly Doc<"objectDefs">[];
	readonly onNavigateRelation?: (target: AdminRelationNavigationTarget) => void;
	readonly record: UnifiedRecord;
}) {
	const router = useRouter();
	const lenderId = record._id as Id<"lenders">;
	const [brokerReassignmentOpen, setBrokerReassignmentOpen] = useState(false);
	const detailContext = useQuery(
		api.crm.detailContextQueries.getLenderDetailContext,
		{
			lenderId,
		}
	);
	const detailFields = filterDetailFields(fields, ["brokerId", "userId"]);
	const currentBrokerId =
		typeof record.fields.brokerId === "string"
			? (record.fields.brokerId as Id<"brokers">)
			: null;
	const currentOrgId =
		typeof record.fields.orgId === "string" ? record.fields.orgId : undefined;
	const relatedGroups: RelatedEntityGroup[] = [
		{
			description: "The sponsoring broker record for this lender.",
			emptyMessage: "No sponsoring broker is linked to this lender.",
			items: detailContext?.broker
				? [
						{
							badges: [formatEnumLabel(detailContext.broker.status)],
							id: String(detailContext.broker.brokerId),
							label:
								detailContext.broker.brokerageName ?? detailContext.broker.name,
							metadata: [
								detailContext.broker.brokerageName
									? detailContext.broker.name
									: null,
								detailContext.broker.email ?? null,
								detailContext.broker.licenseId
									? `License ${detailContext.broker.licenseId}`
									: null,
							]
								.filter(Boolean)
								.join(" • "),
							searchText: [
								detailContext.broker.name,
								detailContext.broker.email,
								detailContext.broker.brokerageName,
								detailContext.broker.licenseId,
							]
								.filter(Boolean)
								.join(" "),
							target: {
								entityType: "brokers",
								recordId: String(detailContext.broker.brokerId),
							},
						},
					]
				: [],
			searchPlaceholder: "Search sponsoring broker",
			title: "Broker",
		},
		{
			description:
				"Deals where this lender has been resolved as the participating buyer.",
			emptyMessage: "No deals are registered for this lender.",
			items: (detailContext?.deals ?? []).map((deal) => ({
				badges: [formatEnumLabel(deal.status)],
				id: String(deal.dealId),
				label: `Deal ${String(deal.dealId)}`,
				metadata: [
					formatPropertyLabel(deal.mortgage.property) ??
						`Mortgage ${String(deal.mortgage.mortgageId)}`,
					deal.closingDate
						? formatDateTime(deal.closingDate)
						: "Closing date TBD",
					formatCentsCurrency(deal.mortgage.principal),
				]
					.filter(Boolean)
					.join(" • "),
				searchText: [
					deal.mortgage.property?.streetAddress,
					deal.mortgage.property?.city,
					deal.mortgage.property?.province,
				]
					.filter(Boolean)
					.join(" "),
				target: {
					entityType: "deals",
					recordId: String(deal.dealId),
				},
			})),
			searchPlaceholder: "Search lender deals",
			title: "Deals",
		},
		{
			description:
				"Mortgages attached to this lender's current and historical deal participation.",
			emptyMessage: "No connected mortgages were found.",
			items: (detailContext?.mortgages ?? []).map((mortgage) => ({
				badges: [formatEnumLabel(mortgage.status)],
				id: String(mortgage.mortgageId),
				label:
					formatPropertyLabel(mortgage.property) ??
					`Mortgage ${String(mortgage.mortgageId)}`,
				metadata: [
					formatCentsCurrency(mortgage.principal),
					formatDate(mortgage.maturityDate) ?? "Maturity unavailable",
				]
					.filter(Boolean)
					.join(" • "),
				searchText: [
					mortgage.property?.streetAddress,
					mortgage.property?.city,
					mortgage.property?.province,
				]
					.filter(Boolean)
					.join(" "),
				target: {
					entityType: "mortgages",
					recordId: String(mortgage.mortgageId),
				},
			})),
			searchPlaceholder: "Search connected mortgages",
			title: "Mortgages",
		},
	];

	return (
		<div className="space-y-6">
			<SectionedRecordDetails
				fields={detailFields}
				highlightFieldNames={[
					"lenderName",
					"contactEmail",
					"brokerSummary",
					"organizationName",
					"status",
					"accreditationStatus",
				]}
				objectDefs={objectDefs}
				onNavigateRelation={onNavigateRelation}
				record={record}
				sections={[
					{
						title: "Contact",
						description: "Linked user profile and organization context.",
						fieldNames: [
							"lenderName",
							"contactEmail",
							"contactPhone",
							"organizationName",
						],
					},
					{
						title: "Broker relationship",
						description: "Sponsoring broker record.",
						fieldNames: ["brokerSummary"],
					},
					{
						title: "Compliance & onboarding",
						description: "Accreditation, identity, and onboarding references.",
						defaultCollapsed: false,
						fieldNames: [
							"accreditationStatus",
							"idvStatus",
							"kycStatus",
							"onboardingEntryPath",
							"onboardingId",
						],
					},
					{
						title: "Payout preferences",
						description: "Operational status and payout cadence.",
						fieldNames: [
							"status",
							"payoutFrequency",
							"lastPayoutDate",
							"minimumPayoutCents",
						],
					},
				]}
			/>

			<DetailSectionShell
				description="Connected broker, deal, and mortgage records for this lender."
				title="Connected Records"
			>
				<div className="space-y-4">
					{detailContext?.profile ? (
						<MetricGrid
							items={[
								{
									label: "Email",
									value: detailContext.profile.email ?? "Unavailable",
								},
								{
									label: "Activated",
									value:
										formatDate(detailContext.profile.activatedAt) ?? "Not set",
								},
								{
									label: "Payout Frequency",
									value: detailContext.profile.payoutFrequency
										? formatEnumLabel(detailContext.profile.payoutFrequency)
										: "Default",
								},
								{
									label: "Accreditation",
									value: formatEnumLabel(
										detailContext.profile.accreditationStatus
									),
								},
							]}
						/>
					) : null}
					{currentBrokerId ? (
						<div className="flex items-center justify-between gap-3 rounded-md border border-border/70 p-3">
							<div className="space-y-1">
								<p className="font-medium text-sm">Broker assignment</p>
								<p className="text-muted-foreground text-sm">
									Update the lender's sponsoring broker and portal access.
								</p>
							</div>
							<Button
								onClick={() => setBrokerReassignmentOpen(true)}
								size="sm"
								type="button"
								variant="outline"
							>
								Change broker
							</Button>
						</div>
					) : null}
					<RelatedEntityExplorer
						groups={relatedGroups}
						objectDefs={objectDefs}
						onNavigateRelation={onNavigateRelation}
					/>
				</div>
			</DetailSectionShell>

			<DetailSectionShell
				description="Recent lender audit events from the journal."
				title="Recent Audit Events"
			>
				<CompactList
					emptyMessage="No recent lender audit events were found."
					items={detailContext?.recentAuditEvents ?? []}
					renderItem={(item) => {
						const event =
							item as NonNullable<LenderDetailContext>["recentAuditEvents"][number];
						return (
							<div className="py-3" key={event.eventId}>
								<p className="font-medium text-sm">{event.eventType}</p>
								<p className="text-muted-foreground text-sm">
									{new Date(event.timestamp).toLocaleString()} • {event.outcome}
									{event.previousState && event.newState
										? ` • ${event.previousState} -> ${event.newState}`
										: ""}
								</p>
							</div>
						);
					}}
				/>
			</DetailSectionShell>

			{currentBrokerId ? (
				<BrokerReassignmentDialog
					currentBrokerId={currentBrokerId}
					currentOrgId={currentOrgId}
					lenderId={lenderId}
					onOpenChange={setBrokerReassignmentOpen}
					onReassigned={() => router.invalidate()}
					open={brokerReassignmentOpen}
				/>
			) : null}
		</div>
	);
}

export function BrokersDedicatedDetails({
	fields,
	objectDefs,
	onNavigateRelation,
	record,
}: {
	readonly fields: readonly NormalizedFieldDefinition[];
	readonly objectDefs?: readonly Doc<"objectDefs">[];
	readonly onNavigateRelation?: (target: AdminRelationNavigationTarget) => void;
	readonly record: UnifiedRecord;
}) {
	const brokerId = record._id as Id<"brokers">;
	const detailContext = useQuery(
		api.crm.detailContextQueries.getBrokerDetailContext,
		{
			brokerId,
		}
	);
	const detailFields = filterDetailFields(fields, ["userId"]);
	const relatedGroups: RelatedEntityGroup[] = [
		{
			description: "Lenders registered under this broker.",
			emptyMessage: "No lenders are registered under this broker yet.",
			items: (detailContext?.lenders ?? []).map((lender) => ({
				badges: [
					formatEnumLabel(lender.status),
					formatEnumLabel(lender.accreditationStatus),
				],
				id: String(lender.lenderId),
				label: lender.name,
				metadata: [
					lender.email ?? null,
					lender.activatedAt ? formatDate(lender.activatedAt) : "Not activated",
					lender.payoutFrequency
						? `Payout ${formatEnumLabel(lender.payoutFrequency)}`
						: null,
				]
					.filter(Boolean)
					.join(" • "),
				searchText: [lender.name, lender.email].filter(Boolean).join(" "),
				target: {
					entityType: "lenders",
					recordId: String(lender.lenderId),
				},
			})),
			searchPlaceholder: "Search broker lenders",
			title: "Lenders",
		},
		{
			description:
				"Mortgages tied to this broker as broker of record or assigned broker.",
			emptyMessage: "No mortgages are linked to this broker.",
			items: (detailContext?.mortgages ?? []).map((mortgage) => ({
				badges: [
					formatEnumLabel(mortgage.status),
					...mortgage.relationshipRoles.map((role) => formatEnumLabel(role)),
				],
				id: String(mortgage.mortgageId),
				label:
					formatPropertyLabel(mortgage.property) ??
					`Mortgage ${String(mortgage.mortgageId)}`,
				metadata: [
					formatCentsCurrency(mortgage.principal),
					`${mortgage.borrowerCount} borrower${mortgage.borrowerCount === 1 ? "" : "s"}`,
					`${mortgage.activeDealCount} deal${mortgage.activeDealCount === 1 ? "" : "s"}`,
				]
					.filter(Boolean)
					.join(" • "),
				searchText: [
					mortgage.property?.streetAddress,
					mortgage.property?.city,
					mortgage.property?.province,
				]
					.filter(Boolean)
					.join(" "),
				target: {
					entityType: "mortgages",
					recordId: String(mortgage.mortgageId),
				},
			})),
			searchPlaceholder: "Search broker mortgages",
			title: "Mortgages",
		},
		{
			description:
				"Borrowers participating in this broker's mortgage portfolio.",
			emptyMessage: "No borrower relationships were found for this broker.",
			items: (detailContext?.borrowers ?? []).map((borrower) => ({
				badges: [formatEnumLabel(borrower.status)],
				id: String(borrower.borrowerId),
				label: borrower.name,
				metadata: [
					borrower.email ?? null,
					borrower.idvStatus ? formatEnumLabel(borrower.idvStatus) : null,
					`${borrower.mortgageCount} mortgage${borrower.mortgageCount === 1 ? "" : "s"}`,
				]
					.filter(Boolean)
					.join(" • "),
				searchText: [borrower.name, borrower.email].filter(Boolean).join(" "),
				target: {
					entityType: "borrowers",
					recordId: String(borrower.borrowerId),
				},
			})),
			searchPlaceholder: "Search broker borrowers",
			title: "Borrowers",
		},
		{
			description: "Deals running across this broker's mortgage book.",
			emptyMessage: "No deals are linked to this broker.",
			items: (detailContext?.deals ?? []).map((deal) => ({
				badges: [formatEnumLabel(deal.status)],
				id: String(deal.dealId),
				label: `Deal ${String(deal.dealId)}`,
				metadata: [
					formatPropertyLabel(deal.property) ??
						`Mortgage ${String(deal.mortgageId)}`,
					deal.closingDate
						? formatDateTime(deal.closingDate)
						: "Closing date TBD",
					deal.lender ? `Lender: ${deal.lender.name}` : null,
				]
					.filter(Boolean)
					.join(" • "),
				searchText: [
					deal.property?.streetAddress,
					deal.property?.city,
					deal.property?.province,
					deal.lender?.name,
					deal.lender?.email,
				]
					.filter(Boolean)
					.join(" "),
				target: {
					entityType: "deals",
					recordId: String(deal.dealId),
				},
			})),
			searchPlaceholder: "Search broker deals",
			title: "Deals",
		},
	];

	return (
		<div className="space-y-6">
			<SectionedRecordDetails
				fields={detailFields}
				highlightFieldNames={[
					"brokerContactName",
					"contactEmail",
					"brokerageName",
					"organizationName",
					"status",
				]}
				objectDefs={objectDefs}
				onNavigateRelation={onNavigateRelation}
				record={record}
				sections={[
					{
						title: "Contact",
						description: "Linked user profile and organization context.",
						fieldNames: [
							"brokerContactName",
							"contactEmail",
							"contactPhone",
							"organizationName",
						],
					},
					{
						title: "Brokerage",
						description: "Licensing and registered business name.",
						fieldNames: ["brokerageName", "licenseId", "licenseProvince"],
					},
					{
						title: "Lifecycle",
						description: "Onboarding and record timestamps.",
						fieldNames: [
							"status",
							"onboardedAt",
							"createdAt",
							"lastTransitionAt",
						],
					},
				]}
			/>

			<DetailSectionShell
				description="All connected lenders, mortgages, borrowers, and deals under this broker."
				title="Connected Records"
			>
				<div className="space-y-4">
					{detailContext?.profile ? (
						<MetricGrid
							items={[
								{
									label: "Email",
									value: detailContext.profile.email ?? "Unavailable",
								},
								{
									label: "Onboarded",
									value:
										formatDate(detailContext.profile.onboardedAt) ?? "Not set",
								},
								{
									label: "Lenders",
									value: detailContext?.lenders.length ?? 0,
								},
								{
									label: "Mortgages",
									value: detailContext?.mortgages.length ?? 0,
								},
							]}
						/>
					) : null}
					<RelatedEntityExplorer
						groups={relatedGroups}
						objectDefs={objectDefs}
						onNavigateRelation={onNavigateRelation}
					/>
				</div>
			</DetailSectionShell>

			<DetailSectionShell
				description="Recent broker audit events from the state machine journal."
				title="Recent Audit Events"
			>
				<CompactList
					emptyMessage="No recent broker audit events were found."
					items={detailContext?.recentAuditEvents ?? []}
					renderItem={(item) => {
						const event =
							item as NonNullable<BrokerDetailContext>["recentAuditEvents"][number];
						return (
							<div className="py-3" key={event.eventId}>
								<p className="font-medium text-sm">{event.eventType}</p>
								<p className="text-muted-foreground text-sm">
									{new Date(event.timestamp).toLocaleString()} • {event.outcome}
									{event.previousState && event.newState
										? ` • ${event.previousState} -> ${event.newState}`
										: ""}
								</p>
							</div>
						);
					}}
				/>
			</DetailSectionShell>
		</div>
	);
}

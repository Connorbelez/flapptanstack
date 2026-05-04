"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import {
	PortfolioDetailHost,
	PortfolioDetailSection,
	PortfolioKeyValueGrid,
	PortfolioKeyValueRow,
} from "./detail-host";
import {
	formatPortfolioCurrency,
	formatPortfolioDate,
	formatPortfolioEnumLabel,
	formatPortfolioPercent,
} from "./portfolio-formatters";
import type { PortfolioPaymentDetail } from "./portfolio-types";
import {
	adminLenderPortfolioPaymentDetailQueryOptions,
	lenderPortfolioPaymentDetailQueryOptions,
	type PortfolioQueryAccess,
} from "./query-options";

interface PaymentSheetProps {
	access: PortfolioQueryAccess;
	obligationId: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

const PAYMENT_SHEET_LOADING_KEYS = [
	"payment-loading-1",
	"payment-loading-2",
	"payment-loading-3",
	"payment-loading-4",
	"payment-loading-5",
	"payment-loading-6",
	"payment-loading-7",
	"payment-loading-8",
] as const;

function SheetLoadingState() {
	return (
		<div className="space-y-5 px-6 py-5">
			<Skeleton className="h-10 w-56" />
			<div className="grid gap-4 sm:grid-cols-2">
				{PAYMENT_SHEET_LOADING_KEYS.map((key) => (
					<Skeleton className="h-20 w-full" key={key} />
				))}
			</div>
		</div>
	);
}

export function PaymentSheet({
	access,
	obligationId,
	onOpenChange,
	open,
}: PaymentSheetProps) {
	if (access.mode === "admin") {
		return (
			<AdminPaymentSheet
				access={access}
				obligationId={obligationId}
				onOpenChange={onOpenChange}
				open={open}
			/>
		);
	}

	return (
		<PortalPaymentSheet
			access={access}
			obligationId={obligationId}
			onOpenChange={onOpenChange}
			open={open}
		/>
	);
}

function PortalPaymentSheet({
	access,
	obligationId,
	onOpenChange,
	open,
}: PaymentSheetProps & {
	access: Extract<PortfolioQueryAccess, { mode: "portal" }>;
}) {
	const { data, error, isPending } = useQuery({
		...lenderPortfolioPaymentDetailQueryOptions(access.portalId, obligationId),
	});

	return (
		<PaymentSheetView
			data={data}
			error={error}
			isPending={isPending}
			onOpenChange={onOpenChange}
			open={open}
		/>
	);
}

function AdminPaymentSheet({
	access,
	obligationId,
	onOpenChange,
	open,
}: PaymentSheetProps & {
	access: Extract<PortfolioQueryAccess, { mode: "admin" }>;
}) {
	const { data, error, isPending } = useQuery({
		...adminLenderPortfolioPaymentDetailQueryOptions(
			access.targetLenderId,
			obligationId
		),
	});

	return (
		<PaymentSheetView
			data={data}
			error={error}
			isPending={isPending}
			onOpenChange={onOpenChange}
			open={open}
		/>
	);
}

interface PaymentSheetViewProps
	extends Omit<PaymentSheetProps, "access" | "obligationId"> {
	data: PortfolioPaymentDetail | undefined;
	error: Error | null;
	isPending: boolean;
}

function PaymentSheetView({
	data,
	error,
	isPending,
	onOpenChange,
	open,
}: PaymentSheetViewProps) {
	let content: ReactNode;
	if (isPending) {
		content = <SheetLoadingState />;
	} else if (error || !data) {
		content = (
			<div className="px-6 py-6 text-muted-foreground text-sm">
				Unable to load the payment detail contract for this obligation.
			</div>
		);
	} else {
		content = (
			<>
				<PortfolioDetailSection
					description="Individual-payment context stays first-class in the host instead of collapsing into a rollup."
					title={data.payment.propertyLabel}
				>
					<div className="space-y-4">
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="secondary">
								{formatPortfolioEnumLabel(data.payment.rowStatus)}
							</Badge>
							<Badge variant="outline">
								{formatPortfolioEnumLabel(data.payment.obligationStatus)}
							</Badge>
						</div>
						<PortfolioKeyValueGrid className="lg:grid-cols-4">
							<PortfolioKeyValueRow
								label="Payment number"
								value={`#${data.payment.paymentNumber}`}
							/>
							<PortfolioKeyValueRow
								label="Due date"
								value={formatPortfolioDate(data.payment.dueDate)}
							/>
							<PortfolioKeyValueRow
								label="Gross amount"
								value={formatPortfolioCurrency(data.payment.grossAmount)}
							/>
							<PortfolioKeyValueRow
								label="Lender share"
								value={formatPortfolioCurrency(data.payment.lenderShareAmount)}
							/>
						</PortfolioKeyValueGrid>
					</div>
				</PortfolioDetailSection>

				<PortfolioDetailSection
					description="Linked mortgage and position context stay visible so the lender can investigate without leaving the route."
					title="Linked context"
				>
					<PortfolioKeyValueGrid>
						<PortfolioKeyValueRow
							label="Property"
							value={`${data.property.streetAddress}, ${data.property.city}`}
						/>
						<PortfolioKeyValueRow
							label="Mortgage status"
							value={formatPortfolioEnumLabel(data.mortgage.status)}
						/>
						<PortfolioKeyValueRow
							label="Position units"
							value={String(data.positionSummary.positionUnits)}
						/>
						<PortfolioKeyValueRow
							label="Share held"
							value={formatPortfolioPercent(
								data.positionSummary.lenderSharePercent
							)}
						/>
					</PortfolioKeyValueGrid>
				</PortfolioDetailSection>

				<PortfolioDetailSection
					description="The timeline stays linear and readable instead of splitting into sidebars or nested cards."
					title="Status timeline"
				>
					<div className="divide-y divide-border/60">
						{data.collectionTimeline.map((event) => (
							<div
								className="flex items-start gap-3 py-4"
								key={`${event.label}-${event.status}-${event.timestampLabel}`}
							>
								<div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
								<div className="space-y-1">
									<p className="font-medium text-sm">{event.label}</p>
									<p className="text-muted-foreground text-sm">
										{formatPortfolioEnumLabel(event.status)} •{" "}
										{event.timestampLabel}
									</p>
								</div>
							</div>
						))}
					</div>
				</PortfolioDetailSection>

				<PortfolioDetailSection title="Payment metadata">
					<PortfolioKeyValueGrid>
						<PortfolioKeyValueRow
							label="Type"
							value={formatPortfolioEnumLabel(data.payment.type)}
						/>
						<PortfolioKeyValueRow
							label="Collection status"
							value={formatPortfolioEnumLabel(
								data.payment.latestCollectionStatus
							)}
						/>
						<PortfolioKeyValueRow
							label="Transfer status"
							value={formatPortfolioEnumLabel(
								data.payment.latestTransferStatus
							)}
						/>
						<PortfolioKeyValueRow
							label="Monthly payment"
							value={formatPortfolioCurrency(data.mortgage.paymentAmount)}
						/>
					</PortfolioKeyValueGrid>
				</PortfolioDetailSection>

				<PortfolioDetailSection
					description="The related actions stay host-owned here; deeper exception handling lands in downstream slices."
					title="Connected actions"
				>
					<div className="divide-y divide-border/60">
						{data.relatedActions.map((action) => (
							<div className="py-4" key={action.id}>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="space-y-1">
										<p className="font-medium text-sm">{action.title}</p>
										<p className="text-muted-foreground text-sm">
											{action.summary}
										</p>
									</div>
									<Badge variant="outline">
										{formatPortfolioEnumLabel(action.kind)}
									</Badge>
								</div>
							</div>
						))}
					</div>
					<div className="mt-4 flex flex-wrap gap-3">
						<Button size="sm" variant="outline">
							Message broker
						</Button>
						<Button size="sm" variant="outline">
							Open linked deal
						</Button>
					</div>
				</PortfolioDetailSection>
			</>
		);
	}

	return (
		<PortfolioDetailHost
			dataTestId="payment-detail-host"
			description="Full-height payment detail host owned by ENG-311. Exception handling and richer follow-up flows can layer in later."
			onOpenChange={onOpenChange}
			open={open}
			title="Payment detail"
		>
			{content}
		</PortfolioDetailHost>
	);
}

"use client";

import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import {
	AlertCircle,
	ArrowLeft,
	Building2,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	FileText,
	Heart,
	ImageIcon,
	Loader2,
	LockKeyhole,
	MapPin,
	MapPinned,
} from "lucide-react";
import { type ReactNode, useEffect, useId, useMemo, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import { Slider } from "#/components/ui/slider";
import { useAuthorization } from "#/lib/auth";
import {
	buildAbsoluteHostUrl,
	resolvePortalHostTypeFromHost,
} from "#/lib/portal/auth-routing";
import { cn } from "#/lib/utils";
import {
	FAIRLEND_ADMIN_LOCAL_HOST,
	FAIRLEND_ADMIN_PRODUCTION_HOST,
} from "../../../shared/portal/contracts";
import { ListingDocumentSidebar } from "./ListingDocumentSidebar";
import { ListingDocumentViewer } from "./ListingDocumentViewer";
import { ListingMap } from "./ListingMap";
import {
	listingDetailActionClasses,
	listingDetailBadgeClasses,
	listingDetailHeroToneClasses,
	listingDetailPaymentClasses,
	listingDetailStateClasses,
	listingDetailSurfaceClasses,
	listingDetailTextClasses,
	listingDetailValueToneClasses,
} from "./listing-detail-styles";
import type {
	ListingAdminQuickLink,
	ListingBadge,
	ListingBorrowerSignal,
	ListingCheckoutReturnState,
	ListingCheckoutSelectedLawyer,
	ListingCheckoutStartInput,
	ListingCheckoutStartResult,
	ListingComparable,
	ListingDetailData,
	ListingDocumentItem,
	ListingHeroImage,
	ListingLawyerOption,
	ListingSimilarCard,
	ListingValueTone,
} from "./listing-detail-types";

const DIGITS_ONLY_PATTERN = /^\d+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORDINAL_MORTGAGE_BADGE_PATTERN = /^(\d+)(ST|ND|RD|TH)\s+MORTGAGE$/u;
const MOBILE_METRIC_VALUE_CLASS =
	"mt-2 truncate whitespace-nowrap font-semibold text-[28px] leading-[1.04] tracking-[-0.03em] tabular-nums";

const LISTING_REVEAL_EASE = [0.22, 1, 0.36, 1] as const;
const LISTING_REVEAL_TRANSITION = {
	duration: 0.44,
	ease: LISTING_REVEAL_EASE,
};
const LOCK_WORKFLOW_SECTION_ID = "listing-lock-workflow";

function checkoutErrorLogDetails(error: unknown): Record<string, unknown> {
	if (error instanceof Error) {
		return {
			message: error.message,
			name: error.name,
			stack: error.stack,
		};
	}
	return { error };
}

function logCheckoutStartFailure(args: {
	error?: unknown;
	input: ListingCheckoutStartInput;
	result?: Extract<ListingCheckoutStartResult, { ok: false }>;
	stage: "backend_result" | "empty_provider_url" | "start_action";
}) {
	console.error("[ListingDetailPage] hosted checkout start failed", {
		listingId: args.input.listingId,
		portalId: args.input.portalId,
		requestedFractions: args.input.requestedFractions,
		resultCode: args.result?.code,
		resultMessage: args.result?.message,
		selectedLawyer: {
			lawyerId:
				args.input.selectedLawyer.type === "platform_lawyer"
					? args.input.selectedLawyer.lawyerId
					: undefined,
			source:
				args.input.selectedLawyer.type === "guest_lawyer"
					? args.input.selectedLawyer.source
					: undefined,
			type: args.input.selectedLawyer.type,
		},
		stage: args.stage,
		...(args.error === undefined ? {} : checkoutErrorLogDetails(args.error)),
	});
}

function ListingScrollReveal({
	children,
	className,
	delay = 0,
}: {
	children: ReactNode;
	className?: string;
	delay?: number;
}) {
	const reduceMotion = useReducedMotion();
	if (reduceMotion) {
		return <div className={className}>{children}</div>;
	}

	return (
		<motion.div
			className={className}
			initial={{ opacity: 0, y: 18 }}
			transition={{ ...LISTING_REVEAL_TRANSITION, delay }}
			viewport={{ amount: 0.12, once: true }}
			whileInView={{ opacity: 1, y: 0 }}
		>
			{children}
		</motion.div>
	);
}

type ListingDetailPageMode = "interactive" | "readOnly";

/** Typed listings index routes supported by the detail shell back link. */
export type ListingsIndexTo =
	| "/listings"
	| "/demo/listings"
	| "/e2e/marketplace-public-documents";

interface ListingDetailPageProps {
	backHref?: string;
	buildSimilarListingHref?: (listingId: string) => string;
	checkoutReturnState?: ListingCheckoutReturnState;
	listing: ListingDetailData;
	mode?: ListingDetailPageMode;
	onStartCheckout?: (
		input: ListingCheckoutStartInput
	) => Promise<ListingCheckoutStartResult>;
	portalId?: string;
	redirectToHostedCheckout?: (url: string) => void;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Large component intentionally composes many presentation controls for read-only and interactive paths.
export function ListingDetailPage({
	backHref = "/demo/listings",
	buildSimilarListingHref = (listingId) => `${backHref}/${listingId}`,
	checkoutReturnState,
	listing,
	mode = "interactive",
	onStartCheckout,
	portalId,
	redirectToHostedCheckout = (url) => {
		window.location.assign(url);
	},
}: ListingDetailPageProps) {
	const checkout = listing.checkout;
	const isInteractive =
		mode === "interactive" && checkout !== undefined && checkout.isEligible;
	const defaultFractions =
		checkout?.defaultFractions ?? listing.investment.minimumFractions ?? 1;
	const minimumFractions =
		checkout?.minimumFractions ?? listing.investment.minimumFractions ?? 1;
	const perFractionAmount =
		checkout?.perFractionAmount ?? listing.investment.perFractionAmount ?? 0;

	const [selectedImageId, setSelectedImageId] = useState<string | undefined>(
		listing.heroImages[0]?.id
	);
	const [selectedDocumentId, setSelectedDocumentId] = useState<
		string | undefined
	>(listing.documents[0]?.id);
	const [selectedLawyerId, setSelectedLawyerId] = useState<string | undefined>(
		checkout?.lawyers[0]?.id
	);
	const [selectedLsoLawyerId, setSelectedLsoLawyerId] = useState<
		string | undefined
	>(checkout?.lsoLawyerSearchResults?.[0]?.lsoLawyerId);
	const [lawyerMode, setLawyerMode] = useState<"guest" | "platform">(
		checkout?.lawyers[0] ? "platform" : "guest"
	);
	const [guestLawyerName, setGuestLawyerName] = useState("");
	const [guestLawyerEmail, setGuestLawyerEmail] = useState("");
	const [guestLawyerFirm, setGuestLawyerFirm] = useState("");
	const [fractionInput, setFractionInput] = useState(String(defaultFractions));
	const [checkoutError, setCheckoutError] = useState<string | null>(null);
	const [isCheckoutPending, setIsCheckoutPending] = useState(false);
	const [showMobileMap, setShowMobileMap] = useState(false);
	const firstHeroImageId = listing.heroImages[0]?.id;
	const firstDocumentId = listing.documents[0]?.id;
	const firstLawyerId = checkout?.lawyers[0]?.id;
	const firstLsoLawyerId = checkout?.lsoLawyerSearchResults?.[0]?.lsoLawyerId;
	const hasFirstLawyer = firstLawyerId !== undefined;
	const adminAuthorization = useAuthorization({
		kind: "permission",
		permission: "admin:access",
	});
	const showAdminQuickLinks =
		!adminAuthorization.loading &&
		adminAuthorization.allowed &&
		(listing.adminQuickLinks?.length ?? 0) > 0;

	useEffect(() => {
		setSelectedImageId(firstHeroImageId);
		setSelectedDocumentId(firstDocumentId);
		setSelectedLawyerId(firstLawyerId);
		setSelectedLsoLawyerId(firstLsoLawyerId);
		setLawyerMode(hasFirstLawyer ? "platform" : "guest");
		setGuestLawyerName("");
		setGuestLawyerEmail("");
		setGuestLawyerFirm("");
		setFractionInput(String(defaultFractions));
		setCheckoutError(null);
		setIsCheckoutPending(false);
		setShowMobileMap(false);
	}, [
		defaultFractions,
		firstDocumentId,
		firstHeroImageId,
		firstLawyerId,
		firstLsoLawyerId,
		hasFirstLawyer,
	]);

	const selectedImageIndex = selectedImageId
		? listing.heroImages.findIndex((image) => image.id === selectedImageId)
		: -1;
	const normalizedImageIndex = selectedImageIndex >= 0 ? selectedImageIndex : 0;
	const selectedImage =
		listing.heroImages[normalizedImageIndex] ?? listing.heroImages[0];
	const selectedDocument = listing.documents.find(
		(document) => document.id === selectedDocumentId
	);
	const selectedLawyer = checkout?.lawyers.find(
		(lawyer) => lawyer.id === selectedLawyerId
	);
	const selectedLsoLawyer = checkout?.lsoLawyerSearchResults?.find(
		(lawyer) => lawyer.lsoLawyerId === selectedLsoLawyerId
	);
	const maximumCheckoutFractions =
		checkout?.maximumFractions ?? listing.investment.availableFractions;
	const referenceLabel =
		listing.referenceLabel ??
		(listing.mlsId ? `MLS #${listing.mlsId}` : undefined);
	const hasAsIfAppraisal = hasPublishedAsIfAppraisal(listing);

	const parsedFractionInput = useMemo(() => {
		const parsed = Number.parseInt(fractionInput, 10);
		if (!Number.isFinite(parsed)) {
			return null;
		}
		return parsed;
	}, [fractionInput]);
	const requestedFractions = parsedFractionInput ?? defaultFractions;

	const effectiveFractions = Math.min(
		Math.max(minimumFractions, requestedFractions),
		maximumCheckoutFractions
	);
	const fractionError =
		fractionInput === "" ||
		!DIGITS_ONLY_PATTERN.test(fractionInput) ||
		parsedFractionInput === null ||
		parsedFractionInput < minimumFractions ||
		parsedFractionInput > maximumCheckoutFractions
			? `Enter ${minimumFractions.toLocaleString()} to ${maximumCheckoutFractions.toLocaleString()} fractions.`
			: null;
	const calculatedInvestment = effectiveFractions * perFractionAmount;
	const selectedLawyerSnapshot = buildSelectedLawyerSnapshot({
		guestFirm: guestLawyerFirm,
		guestEmail: guestLawyerEmail,
		guestName: guestLawyerName,
		lawyerMode,
		selectedLsoLawyer,
		selectedLawyer,
	});
	const lawyerError = getLawyerError({
		lawyerMode,
		selectedLawyerSnapshot,
		selectedLsoLawyer,
	});
	const canStartCheckout =
		isInteractive &&
		fractionError === null &&
		lawyerError === null &&
		selectedLawyerSnapshot !== null &&
		onStartCheckout !== undefined &&
		portalId !== undefined &&
		!isCheckoutPending;
	const ctaLabel = checkout
		? `Lock ${effectiveFractions} fractions, pay ${checkout.lockFee.display} fee`
		: "";
	const summaryParagraphs = splitSummary(listing.summary);
	const reduceMotion = useReducedMotion();

	async function handleStartCheckout() {
		if (
			!canStartCheckout ||
			selectedLawyerSnapshot === null ||
			portalId === undefined ||
			onStartCheckout === undefined
		) {
			return;
		}

		setCheckoutError(null);
		setIsCheckoutPending(true);
		const checkoutStartInput = {
			listingId: listing.id,
			portalId,
			requestedFractions,
			selectedLawyer: selectedLawyerSnapshot,
		};
		try {
			const result = await onStartCheckout(checkoutStartInput);
			if (!result.ok) {
				logCheckoutStartFailure({
					input: checkoutStartInput,
					result,
					stage: "backend_result",
				});
				setCheckoutError(result.message);
				return;
			}
			if (result.stripeCheckoutUrl.trim().length === 0) {
				logCheckoutStartFailure({
					input: checkoutStartInput,
					stage: "empty_provider_url",
				});
				setCheckoutError(
					"Hosted checkout is unavailable. Try again in a moment."
				);
				return;
			}
			redirectToHostedCheckout(result.stripeCheckoutUrl);
		} catch (error) {
			logCheckoutStartFailure({
				error,
				input: checkoutStartInput,
				stage: "start_action",
			});
			setCheckoutError(
				"We could not open hosted checkout. Try again in a moment."
			);
		} finally {
			setIsCheckoutPending(false);
		}
	}

	function goToNextImage() {
		if (listing.heroImages.length <= 1) {
			return;
		}
		setSelectedImageId(
			listing.heroImages[(normalizedImageIndex + 1) % listing.heroImages.length]
				?.id
		);
	}

	function goToPreviousImage() {
		if (listing.heroImages.length <= 1) {
			return;
		}
		setSelectedImageId(
			listing.heroImages[
				(normalizedImageIndex - 1 + listing.heroImages.length) %
					listing.heroImages.length
			]?.id
		);
	}

	function normalizeFractions(value: number) {
		return String(
			Math.min(Math.max(minimumFractions, value), maximumCheckoutFractions)
		);
	}

	function handleFractionChange(nextValue: string) {
		if (nextValue === "") {
			setFractionInput("");
			return;
		}

		if (DIGITS_ONLY_PATTERN.test(nextValue)) {
			setFractionInput(nextValue);
		}
	}

	function handleFractionBlur() {
		setFractionInput(
			normalizeFractions(parsedFractionInput ?? defaultFractions)
		);
	}

	function scrollToLockWorkflow() {
		document
			.getElementById(LOCK_WORKFLOW_SECTION_ID)
			?.scrollIntoView({ behavior: "smooth", block: "start" });
	}

	return (
		<div className="flex min-h-0 w-full min-w-0 flex-1 flex-col text-foreground">
			<div className="hidden lg:block">
				<DesktopTopNav backHref={backHref} mode={mode} />
			</div>
			<div className="lg:hidden">
				<MobileTopNav backHref={backHref} mode={mode} />
			</div>

			<div className="hidden lg:block" data-testid="desktop-listing-detail">
				<motion.section
					animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
					className="flex h-[480px] gap-4 px-16 pt-4"
					initial={reduceMotion ? false : { opacity: 0, y: 16 }}
					transition={{ ...LISTING_REVEAL_TRANSITION, delay: 0.02 }}
				>
					<div className="relative flex-1 overflow-hidden rounded-xl">
						<MediaPanel image={selectedImage} />
						<HeroArrowButton
							ariaLabel="Previous photo"
							className="left-4"
							direction="left"
							disabled={listing.heroImages.length <= 1}
							onClick={goToPreviousImage}
						/>
						<HeroArrowButton
							ariaLabel="Next photo"
							className="right-4"
							direction="right"
							disabled={listing.heroImages.length <= 1}
							onClick={goToNextImage}
						/>
						<div
							className={cn(
								"absolute right-4 bottom-4 rounded-lg px-3 py-1 font-medium text-sm",
								listingDetailBadgeClasses.imageCount
							)}
						>
							{selectedImage ? normalizedImageIndex + 1 : 0} of{" "}
							{listing.heroImages.length} photos
						</div>
					</div>
					<MapPanel listing={listing} mapPanelId="listing-map" />
				</motion.section>

				<motion.section
					animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
					className="flex gap-3 px-16 pt-4"
					initial={reduceMotion ? false : { opacity: 0, y: 12 }}
					transition={{ ...LISTING_REVEAL_TRANSITION, delay: 0.1 }}
				>
					{listing.heroImages.slice(0, 6).map((image) => (
						<button
							className={cn(
								"relative h-16 w-[88px] cursor-pointer overflow-hidden rounded-lg border transition-all",
								image.id === selectedImage?.id
									? "border-primary ring-1 ring-primary"
									: "border-border/80"
							)}
							key={image.id}
							onClick={() => setSelectedImageId(image.id)}
							type="button"
						>
							<MediaPanel compact image={image} />
							<span className="sr-only">View {image.label}</span>
						</button>
					))}
				</motion.section>

				<motion.section
					animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
					className="flex gap-10 px-16 pt-10"
					initial={reduceMotion ? false : { opacity: 0, y: 14 }}
					transition={{ ...LISTING_REVEAL_TRANSITION, delay: 0.16 }}
				>
					<div className="max-w-[932px] flex-1">
						<div className="space-y-5">
							<div className="flex flex-wrap gap-2">
								{listing.badges.map((badge) => (
									<BadgePill badge={badge} key={badge.id} />
								))}
								{showAdminQuickLinks ? (
									<AdminQuickLinksMenu links={listing.adminQuickLinks ?? []} />
								) : null}
							</div>
							<div className="space-y-2">
								<h1 className="font-semibold text-[44px] leading-[1.04] tracking-[-0.03em]">
									{listing.title}
								</h1>
								<p className="text-muted-foreground text-sm">
									{listing.listedLabel}
									{referenceLabel ? ` · ${referenceLabel}` : ""}
								</p>
							</div>
							{isInteractive && checkout ? (
								<div className="flex flex-wrap items-center gap-3 pt-1">
									<Button
										className={cn(
											"h-11 rounded-full px-5",
											listingDetailActionClasses.primary
										)}
										onClick={scrollToLockWorkflow}
										type="button"
									>
										<LockKeyhole className="size-4" />
										Start fraction lock
									</Button>
									<p className="text-muted-foreground text-sm">
										Pay the {checkout.lockFee.display} lock fee through hosted
										Stripe checkout.
									</p>
								</div>
							) : null}
							<div className="space-y-4">
								<SectionLabel>Executive Summary</SectionLabel>
								<div className="max-w-prose space-y-3 text-[15px] text-foreground/90 leading-[1.65] dark:text-foreground/85">
									{summaryParagraphs.map((paragraph) => (
										<p key={paragraph}>{paragraph}</p>
									))}
								</div>
							</div>
						</div>
					</div>

					<WhiteSurface className="ml-auto w-[340px] shrink-0 self-start px-6 py-6">
						<SectionLabel className="mb-5">At a Glance</SectionLabel>
						<div className="space-y-4">
							{listing.atAGlance.map((item) => (
								<div
									className="flex items-center justify-between border-border/60 border-b pb-3 last:border-b-0 last:pb-0"
									key={item.label}
								>
									<span className="text-muted-foreground text-sm">
										{item.label}
									</span>
									<span
										className={cn(
											"font-medium text-sm",
											listingDetailValueToneClasses[item.tone ?? "default"]
										)}
									>
										{item.value}
									</span>
								</div>
							))}
						</div>
					</WhiteSurface>
				</motion.section>

				<DesktopFinancials listing={listing} />
				<DesktopAppraisal listing={listing} />
				<DesktopComparables listing={listing} />
				<DesktopBorrowerAndHistory listing={listing} />
				<DesktopDocuments
					documents={listing.documents}
					listingId={listing.id}
					onDocumentSelect={setSelectedDocumentId}
					selectedDocumentId={selectedDocument?.id}
				/>
				<InvestmentSummaryCard
					className="mx-16 mt-10"
					isInteractive={isInteractive}
					listing={listing}
				/>
				<CheckoutReturnStateBanner
					className="mx-16 mt-6"
					state={checkoutReturnState}
				/>

				{isInteractive && checkout ? (
					<HostedCheckoutLauncher
						availableFractions={maximumCheckoutFractions}
						calculatedInvestment={calculatedInvestment}
						canStartCheckout={canStartCheckout}
						checkout={checkout}
						checkoutError={checkoutError}
						ctaLabel={ctaLabel}
						fractionError={fractionError}
						fractionInput={fractionInput}
						fractions={effectiveFractions}
						guestLawyerEmail={guestLawyerEmail}
						guestLawyerFirm={guestLawyerFirm}
						guestLawyerName={guestLawyerName}
						isCheckoutPending={isCheckoutPending}
						lawyerError={lawyerError}
						lawyerMode={lawyerMode}
						listingTitle={listing.title}
						minimumFractions={minimumFractions}
						onFractionBlur={handleFractionBlur}
						onFractionChange={handleFractionChange}
						onGuestLawyerEmailChange={setGuestLawyerEmail}
						onGuestLawyerFirmChange={setGuestLawyerFirm}
						onGuestLawyerNameChange={setGuestLawyerName}
						onLawyerModeChange={setLawyerMode}
						onLsoLawyerSelect={setSelectedLsoLawyerId}
						onPlatformLawyerSelect={setSelectedLawyerId}
						onStartCheckout={handleStartCheckout}
						selectedLawyer={selectedLawyer}
						selectedLsoLawyer={selectedLsoLawyer}
					/>
				) : (
					<ReadOnlyMarketplaceNotice
						availableFractions={maximumCheckoutFractions}
						className="mx-16 mt-6"
						reason={checkout?.disabledReason}
						totalFractions={listing.investment.totalFractions}
					/>
				)}

				<ListingScrollReveal className="px-16 pt-10">
					<SimilarListingsSection
						buildHref={buildSimilarListingHref}
						cards={listing.similarListings}
						title="You May Also Be Interested In"
					/>
				</ListingScrollReveal>
			</div>

			<div className="lg:hidden" data-testid="mobile-listing-detail">
				<motion.section
					animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
					className="relative h-[260px]"
					initial={reduceMotion ? false : { opacity: 0, y: 10 }}
					transition={{ ...LISTING_REVEAL_TRANSITION, delay: 0.04 }}
				>
					<MediaPanel image={selectedImage} />
					<div
						className={cn(
							"absolute right-4 bottom-4 rounded-lg px-3 py-1 font-medium text-sm",
							listingDetailBadgeClasses.imageCount
						)}
					>
						{selectedImage ? normalizedImageIndex + 1 : 0} /{" "}
						{listing.heroImages.length}
					</div>
				</motion.section>

				<section className="px-5 pt-5">
					<div className="flex flex-wrap gap-1.5">
						{listing.badges.map((badge) => (
							<BadgePill badge={badge} key={badge.id} mobile />
						))}
						{showAdminQuickLinks ? (
							<AdminQuickLinksMenu
								links={listing.adminQuickLinks ?? []}
								mobile
							/>
						) : null}
					</div>
					<h1 className="mt-3 font-semibold text-[24px] leading-[1.08] tracking-[-0.03em]">
						{listing.title}
					</h1>
					<p className="mt-2 text-muted-foreground text-sm">
						{listing.listedLabel}
						{referenceLabel ? ` · ${referenceLabel}` : ""}
					</p>
					{isInteractive && checkout ? (
						<div className="mt-4 space-y-2">
							<Button
								className={cn(
									"h-11 w-full rounded-full",
									listingDetailActionClasses.primary
								)}
								onClick={scrollToLockWorkflow}
								type="button"
							>
								<LockKeyhole className="size-4" />
								Start fraction lock
							</Button>
							<p className="text-center text-muted-foreground text-xs">
								Pay the {checkout.lockFee.display} lock fee through hosted
								Stripe checkout.
							</p>
						</div>
					) : null}
				</section>

				<section className="px-5 pt-4">
					<button
						className={cn(
							"flex w-full items-center justify-center gap-2 px-4 py-3 font-medium text-[15px]",
							listingDetailSurfaceClasses.island
						)}
						onClick={() => setShowMobileMap((current) => !current)}
						type="button"
					>
						<MapPinned className="size-4" />
						{showMobileMap ? "Hide map" : "Show map"} for{" "}
						{listing.map.locationText}
					</button>
				</section>

				{showMobileMap ? (
					<section className="px-5 pt-4">
						<MapPanel className="h-[220px]" listing={listing} />
					</section>
				) : null}

				<ListingScrollReveal className="px-5 pt-6">
					<SectionLabel>Executive Summary</SectionLabel>
					<div className="mt-3 max-w-prose space-y-3 text-[15px] text-foreground/90 leading-[1.65] dark:text-foreground/85">
						{summaryParagraphs.map((paragraph) => (
							<p key={paragraph}>{paragraph}</p>
						))}
					</div>
				</ListingScrollReveal>

				<ListingScrollReveal className="px-5 pt-6">
					<SectionLabel>Key Financials</SectionLabel>
					<div className="mt-3 grid grid-cols-2 gap-2">
						{listing.keyFinancials.slice(0, 6).map((item) => (
							<CompactMetricCard item={item} key={item.label} />
						))}
					</div>
				</ListingScrollReveal>

				<ListingScrollReveal className="px-5 pt-6">
					<SectionLabel>Appraisal</SectionLabel>
					<div className="mt-3 space-y-3">
						<WhiteSurface className="px-5 py-5">
							<div className="flex items-start justify-between gap-4">
								<div>
									<h2 className="font-semibold text-[22px] leading-none">
										{listing.appraisal.asIs.label}
									</h2>
								</div>
								<span className="font-medium text-muted-foreground text-xs uppercase tracking-[0.22em]">
									{listing.appraisal.asIs.note}
								</span>
							</div>
							<div className="mt-5 space-y-4">
								<div className="min-w-0">
									<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
										Appraised value
									</p>
									<p
										className={cn(MOBILE_METRIC_VALUE_CLASS, "text-[34px]")}
										title={listing.appraisal.asIs.value}
									>
										{listing.appraisal.asIs.value}
									</p>
								</div>
								<div className="grid grid-cols-2 gap-4 text-sm">
									<div>
										<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
											Date
										</p>
										<p className="mt-1">{listing.appraisal.asIs.date}</p>
									</div>
									<div>
										<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
											{listing.appraisal.asIs.secondaryLabel ?? "Effective"}
										</p>
										<p className="mt-1">
											{listing.appraisal.asIs.secondaryValue}
										</p>
									</div>
								</div>
							</div>
						</WhiteSurface>

						{hasAsIfAppraisal ? (
							<WhiteSurface className="border-dashed px-5 py-5">
								<div className="flex items-center gap-2">
									<h2 className="font-semibold text-[22px] leading-none">
										{listing.appraisal.asIf.label}
									</h2>
									<span
										className={cn(
											"font-semibold text-[10px] uppercase tracking-[0.24em]",
											listingDetailTextClasses.warning
										)}
									>
										Projected
									</span>
								</div>
								<p className="mt-4 font-semibold text-[40px] leading-none tracking-[-0.04em]">
									{listing.appraisal.asIf.value}
								</p>
								<p className="mt-3 max-w-[24ch] text-foreground/90 text-sm leading-6">
									{listing.appraisal.asIf.note}
								</p>
							</WhiteSurface>
						) : null}
					</div>
				</ListingScrollReveal>

				<MobileComparablesSection listing={listing} />

				<ListingScrollReveal className="px-5 pt-6">
					<SectionLabel>Borrower Signals</SectionLabel>
					<WhiteSurface className="mt-3 px-5 py-5">
						<div className="flex gap-3">
							<div className="flex size-14 items-center justify-center rounded-full border border-[var(--palm)] text-[var(--palm)]">
								<span className="font-semibold text-[22px] leading-none">
									{listing.borrowerSignals.grade}
								</span>
							</div>
							<div>
								<p className="font-semibold text-[22px] leading-none">
									Score: {listing.borrowerSignals.score}
								</p>
								<p className="mt-2 text-muted-foreground text-sm">
									{listing.borrowerSignals.subtitle}
								</p>
							</div>
						</div>
						<div className="mt-5 space-y-4">
							{listing.borrowerSignals.items.map((item) => (
								<SignalRow item={item} key={item.id} />
							))}
						</div>
					</WhiteSurface>
				</ListingScrollReveal>

				<ListingScrollReveal className="px-5 pt-6">
					<WhiteSurface className="px-5 py-5">
						<SectionLabel>Payment History</SectionLabel>
						<UpcomingPaymentCallout listing={listing} />
						<div className="mt-4 flex gap-6">
							<MetricSummary
								label="On-time"
								value={listing.paymentHistory.onTimeRate}
							/>
							<MetricSummary
								label="Late"
								value={String(listing.paymentHistory.lateCount)}
							/>
							<MetricSummary
								label="Missed"
								value={String(listing.paymentHistory.missedCount)}
							/>
						</div>
						<div className="mt-5 flex flex-wrap gap-1.5">
							{listing.paymentHistory.months.length > 0 ? (
								listing.paymentHistory.months.map((month) => (
									<div
										className={cn(
											"flex h-6 w-6 items-center justify-center rounded-md font-semibold text-[9px] uppercase",
											monthStatusClass(month.status)
										)}
										key={month.id}
										title={`${month.label} · ${month.status}`}
									>
										{month.label}
									</div>
								))
							) : (
								<p className="text-muted-foreground text-sm">
									No month-by-month payment tape is published for this listing.
								</p>
							)}
						</div>
					</WhiteSurface>
				</ListingScrollReveal>

				<ListingScrollReveal className="px-5 pt-6">
					<SectionLabel>Documents</SectionLabel>
					{listing.documents.length > 0 ? (
						<div className="mt-3 space-y-3">
							<ListingDocumentSidebar
								documents={listing.documents}
								mobile
								onSelect={setSelectedDocumentId}
								selectedDocumentId={selectedDocument?.id}
							/>

							<WhiteSurface className="px-4 py-4">
								<ListingDocumentViewer
									document={selectedDocument}
									listingId={listing.id}
									mobile
								/>
							</WhiteSurface>
						</div>
					) : (
						<WhiteSurface className="mt-3 px-4 py-4">
							<ListingDocumentViewer listingId={listing.id} mobile />
						</WhiteSurface>
					)}
				</ListingScrollReveal>

				<InvestmentSummaryCard
					className="mx-5 mt-6"
					isInteractive={isInteractive}
					listing={listing}
					mobile
				/>
				<CheckoutReturnStateBanner
					className="mx-5 mt-4"
					state={checkoutReturnState}
				/>

				{isInteractive && checkout ? (
					<HostedCheckoutLauncher
						availableFractions={maximumCheckoutFractions}
						calculatedInvestment={calculatedInvestment}
						canStartCheckout={canStartCheckout}
						checkout={checkout}
						checkoutError={checkoutError}
						ctaLabel={ctaLabel}
						fractionError={fractionError}
						fractionInput={fractionInput}
						fractions={effectiveFractions}
						guestLawyerEmail={guestLawyerEmail}
						guestLawyerFirm={guestLawyerFirm}
						guestLawyerName={guestLawyerName}
						isCheckoutPending={isCheckoutPending}
						isMobile
						lawyerError={lawyerError}
						lawyerMode={lawyerMode}
						listingTitle={listing.title}
						minimumFractions={minimumFractions}
						onFractionBlur={handleFractionBlur}
						onFractionChange={handleFractionChange}
						onGuestLawyerEmailChange={setGuestLawyerEmail}
						onGuestLawyerFirmChange={setGuestLawyerFirm}
						onGuestLawyerNameChange={setGuestLawyerName}
						onLawyerModeChange={setLawyerMode}
						onLsoLawyerSelect={setSelectedLsoLawyerId}
						onPlatformLawyerSelect={setSelectedLawyerId}
						onStartCheckout={handleStartCheckout}
						selectedLawyer={selectedLawyer}
						selectedLsoLawyer={selectedLsoLawyer}
					/>
				) : (
					<ReadOnlyMarketplaceNotice
						availableFractions={maximumCheckoutFractions}
						className="mx-5 mt-4"
						reason={checkout?.disabledReason}
						totalFractions={listing.investment.totalFractions}
					/>
				)}

				<SimilarListingsSection
					buildHref={buildSimilarListingHref}
					cards={listing.similarListings}
					className="px-5 pt-6"
					mobile
					title="Similar listings"
				/>
			</div>
		</div>
	);
}

function DesktopTopNav({
	backHref,
	mode,
}: {
	backHref: string;
	mode: ListingDetailPageMode;
}) {
	return (
		<header
			className={cn(
				"flex items-center justify-between border-b px-16 py-4",
				listingDetailSurfaceClasses.header
			)}
		>
			<Link
				className="inline-flex items-center gap-2 font-medium text-[13px] text-muted-foreground hover:text-foreground"
				to={backHref}
				viewTransition
			>
				<ArrowLeft className="size-4" />
				Back to Listings
			</Link>

			<div className="flex items-center gap-3">
				<div
					className={cn(
						"inline-flex items-center gap-2 rounded-full px-3 py-2 text-[12px]",
						listingDetailBadgeClasses.statusPill
					)}
				>
					<span className="size-1.5 rounded-full bg-[var(--lagoon)]" />
					{mode === "readOnly" ? "Read-only marketplace" : "12 viewing now"}
				</div>
				{mode === "interactive" ? (
					<button
						className={cn(
							"inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium text-[13px]",
							listingDetailActionClasses.secondaryPill
						)}
						type="button"
					>
						<Heart className="size-4" />
						Save
					</button>
				) : null}
			</div>
		</header>
	);
}

function MobileTopNav({
	backHref,
	mode,
}: {
	backHref: string;
	mode: ListingDetailPageMode;
}) {
	return (
		<header
			className={cn(
				"flex items-center justify-between border-b px-5 py-3",
				listingDetailSurfaceClasses.header
			)}
		>
			<Link
				aria-label="Back to Listings"
				className="-ml-3 inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
				to={backHref}
				viewTransition
			>
				<ChevronLeft className="size-5 text-muted-foreground" />
			</Link>
			<div className="flex items-center gap-3 text-[12px]">
				<div
					aria-label={
						mode === "readOnly"
							? "Read-only marketplace listing"
							: "12 people viewing this listing now"
					}
					className={cn(
						"inline-flex min-h-8 items-center gap-1 rounded-full px-2.5",
						listingDetailBadgeClasses.statusPill
					)}
					role="status"
				>
					<span className="size-1.5 rounded-full bg-[var(--lagoon)]" />
					{mode === "readOnly" ? "Read-only" : "12 viewing"}
				</div>
				{mode === "interactive" ? (
					<button
						className="-mr-3 inline-flex size-11 items-center justify-center rounded-full transition hover:bg-muted/40"
						type="button"
					>
						<Heart className="size-4 text-muted-foreground" />
						<span className="sr-only">Save listing</span>
					</button>
				) : null}
			</div>
		</header>
	);
}

function DesktopFinancials({ listing }: { listing: ListingDetailData }) {
	const reduceMotion = useReducedMotion();
	const staggerContainer = {
		hidden: {},
		visible: {
			transition: { delayChildren: 0.04, staggerChildren: 0.055 },
		},
	};
	const staggerItem = {
		hidden: { opacity: 0, y: 14 },
		visible: { opacity: 1, y: 0, transition: LISTING_REVEAL_TRANSITION },
	};

	return (
		<ListingScrollReveal className="px-16 pt-10">
			<SectionLabel>Key Financials</SectionLabel>
			{reduceMotion ? (
				<div className="mt-5 grid grid-cols-4 gap-4">
					{listing.keyFinancials.map((item) => (
						<MetricCard item={item} key={item.label} />
					))}
				</div>
			) : (
				<motion.div
					className="mt-5 grid grid-cols-4 gap-4"
					initial="hidden"
					variants={staggerContainer}
					viewport={{ amount: 0.12, once: true }}
					whileInView="visible"
				>
					{listing.keyFinancials.map((item) => (
						<motion.div key={item.label} variants={staggerItem}>
							<MetricCard item={item} />
						</motion.div>
					))}
				</motion.div>
			)}
		</ListingScrollReveal>
	);
}

function hasPublishedAsIfAppraisal(listing: ListingDetailData) {
	return (
		listing.appraisal.hasAsIf ?? listing.appraisal.asIf.value !== "Unavailable"
	);
}

function DesktopAppraisal({ listing }: { listing: ListingDetailData }) {
	const hasAsIfAppraisal = hasPublishedAsIfAppraisal(listing);

	return (
		<ListingScrollReveal className="px-16 pt-10">
			<SectionLabel>Appraisal</SectionLabel>
			<div
				className={cn(
					"mt-5 grid gap-6",
					hasAsIfAppraisal ? "grid-cols-[minmax(0,1fr)_320px]" : "grid-cols-1"
				)}
			>
				<WhiteSurface className="px-7 py-6">
					<div className="flex items-start justify-between">
						<div>
							<h2 className="font-semibold text-[24px]">
								{listing.appraisal.asIs.label}
							</h2>
							<p className="mt-3 text-muted-foreground text-sm">
								Appraised value
							</p>
							<p className="mt-1 font-semibold text-[44px] leading-none tracking-[-0.04em]">
								{listing.appraisal.asIs.value}
							</p>
						</div>
						<p className="text-muted-foreground text-xs uppercase tracking-[0.22em]">
							{listing.appraisal.asIs.note}
						</p>
					</div>
					<div className="mt-8 grid grid-cols-3 gap-4 text-sm">
						<InfoColumn
							label="Date"
							value={listing.appraisal.asIs.date ?? ""}
						/>
						<InfoColumn
							label={listing.appraisal.asIs.secondaryLabel ?? "Effective"}
							value={listing.appraisal.asIs.secondaryValue ?? ""}
						/>
						<InfoColumn label="Type" value={listing.appraisal.asIs.note} />
					</div>
				</WhiteSurface>

				{hasAsIfAppraisal ? (
					<WhiteSurface className="border-dashed px-6 py-6">
						<div className="flex items-center gap-2">
							<h2 className="font-semibold text-[24px]">
								{listing.appraisal.asIf.label}
							</h2>
							<span
								className={cn(
									"font-semibold text-[10px] uppercase tracking-[0.24em]",
									listingDetailTextClasses.warning
								)}
							>
								Projected
							</span>
						</div>
						<p className="mt-5 font-semibold text-[44px] leading-none tracking-[-0.04em]">
							{listing.appraisal.asIf.value}
						</p>
						<p className="mt-4 text-foreground/90 text-sm leading-6">
							{listing.appraisal.asIf.note}
						</p>
					</WhiteSurface>
				) : null}
			</div>
		</ListingScrollReveal>
	);
}

function DesktopComparables({ listing }: { listing: ListingDetailData }) {
	const hasAsIfAppraisal = hasPublishedAsIfAppraisal(listing);

	return (
		<ListingScrollReveal className="px-16 pt-4">
			<div
				className={cn(
					"grid gap-6",
					hasAsIfAppraisal ? "grid-cols-2" : "grid-cols-1"
				)}
			>
				<ComparableTable
					rows={listing.comparables.asIs}
					title="As-Is Comparables"
				/>
				{hasAsIfAppraisal ? (
					<ComparableTable
						projected
						rows={listing.comparables.asIf}
						title="As-If Comparables"
					/>
				) : null}
			</div>
		</ListingScrollReveal>
	);
}

function DesktopBorrowerAndHistory({
	listing,
}: {
	listing: ListingDetailData;
}) {
	return (
		<ListingScrollReveal className="px-16 pt-10">
			<SectionLabel>Borrower</SectionLabel>
			<div className="mt-5 grid grid-cols-2 gap-6">
				<WhiteSurface className="px-7 py-7">
					<div className="flex items-start justify-between gap-4">
						<div className="flex items-center gap-4">
							<div className="flex size-16 items-center justify-center rounded-full border border-[var(--palm)] text-[var(--palm)]">
								<span className="font-semibold text-[28px] leading-none">
									{listing.borrowerSignals.grade}
								</span>
							</div>
							<div>
								<p className="font-semibold text-[22px]">
									Composite Score: {listing.borrowerSignals.score}
								</p>
								<p className="mt-1 text-muted-foreground text-sm">
									{listing.borrowerSignals.subtitle}
								</p>
							</div>
						</div>
						<p className="text-[11px] text-muted-foreground uppercase tracking-[0.22em]">
							{listing.borrowerSignals.note}
						</p>
					</div>
					<div className="mt-8 space-y-5">
						{listing.borrowerSignals.items.map((item) => (
							<SignalRow item={item} key={item.id} />
						))}
					</div>
				</WhiteSurface>

				<WhiteSurface className="px-7 py-7">
					<SectionLabel>Payment History</SectionLabel>
					<UpcomingPaymentCallout listing={listing} />
					<div className="mt-6 flex gap-8">
						<MetricSummary
							label="On-time"
							value={listing.paymentHistory.onTimeRate}
						/>
						<MetricSummary
							label="Late"
							value={String(listing.paymentHistory.lateCount)}
						/>
						<MetricSummary
							label="Missed"
							value={String(listing.paymentHistory.missedCount)}
						/>
					</div>
					<div className="mt-8">
						<p className="font-medium text-[13px] text-muted-foreground">
							Payment Timeline
						</p>
						{listing.paymentHistory.months.length > 0 ? (
							<>
								<div className="mt-4 flex flex-wrap gap-1.5">
									{listing.paymentHistory.months.map((month) => (
										<div
											className={cn(
												"flex h-8 min-w-8 items-center justify-center rounded-md px-2 font-semibold text-[10px] uppercase",
												monthStatusClass(month.status)
											)}
											key={month.id}
											title={`${month.label} · ${month.status}`}
										>
											{month.label}
										</div>
									))}
								</div>
								<div className="mt-4 flex gap-4 text-[11px] text-muted-foreground">
									<LegendChip color="bg-[var(--palm)]" label="On-time" />
									<LegendChip
										color="bg-[color-mix(in_oklab,var(--palm)_58%,var(--destructive))]"
										label="Late (1-30 days)"
									/>
									<LegendChip
										color="bg-destructive"
										label="Missed (30+ days)"
									/>
								</div>
							</>
						) : (
							<p className="mt-4 text-muted-foreground text-sm">
								No month-by-month payment tape is published for this listing.
							</p>
						)}
					</div>
				</WhiteSurface>
			</div>
		</ListingScrollReveal>
	);
}

function DesktopDocuments({
	listingId,
	documents,
	selectedDocumentId,
	onDocumentSelect,
}: {
	documents: ListingDocumentItem[];
	listingId: string;
	onDocumentSelect: (documentId: string) => void;
	selectedDocumentId?: string;
}) {
	const selectedDocument = documents.find(
		(document) => document.id === selectedDocumentId
	);

	return (
		<ListingScrollReveal className="px-16 pt-10">
			<SectionLabel>Documents</SectionLabel>
			<div
				className={cn(
					listingDetailSurfaceClasses.documentShell,
					listingDetailSurfaceClasses.island
				)}
			>
				<div className="w-[260px] border-border/70 border-r bg-muted/15 p-3">
					<ListingDocumentSidebar
						documents={documents}
						onSelect={onDocumentSelect}
						selectedDocumentId={selectedDocument?.id}
					/>
				</div>
				<div className="h-[min(78vh,920px)] min-h-[680px] flex-1 overflow-hidden bg-muted/25 p-4">
					<ListingDocumentViewer
						document={selectedDocument}
						listingId={listingId}
					/>
				</div>
			</div>
		</ListingScrollReveal>
	);
}

function InvestmentSummaryCard({
	className,
	isInteractive,
	listing,
	mobile = false,
}: {
	className?: string;
	isInteractive: boolean;
	listing: ListingDetailData;
	mobile?: boolean;
}) {
	const minimumFractions =
		listing.investment.minimumFractions ??
		listing.checkout?.minimumFractions ??
		1;
	const perFractionAmount =
		listing.investment.perFractionAmount ??
		listing.checkout?.perFractionAmount ??
		0;
	const sectionLabel = isInteractive
		? "Invest in this mortgage"
		: "Marketplace availability";
	const availabilityLabel = isInteractive
		? "Fraction availability"
		: "Published availability";
	const minimumLabel = isInteractive ? "Minimum lock" : "Listed minimum lock";
	const supportingCopy = isInteractive
		? listing.investment.investorCountLabel
		: "Availability is current. Reservations and checkout are disabled for this listing.";
	const availableFractionsLine = isInteractive
		? `Currently available: ${listing.investment.availableFractions.toLocaleString()} fractions`
		: null;

	if (mobile) {
		return (
			<section className={className}>
				<SectionLabel>{sectionLabel}</SectionLabel>
				<WhiteSurface className="mt-3 px-5 py-5">
					<div className="flex items-baseline justify-between gap-4">
						<span className="text-muted-foreground text-sm">
							{availabilityLabel}
						</span>
						<span className="font-medium text-[15px] text-foreground">
							{listing.investment.availabilityLabel}
						</span>
					</div>
					<div className="mt-3 h-2 rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-[var(--palm)]"
							style={{ width: `${listing.investment.availabilityValue}%` }}
						/>
					</div>
					<div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4">
						<MiniMetric
							compact
							label="Per fraction"
							value={formatCurrency(perFractionAmount)}
						/>
						<MiniMetric
							compact
							label={minimumLabel}
							value={`${minimumFractions} frac.`}
						/>
						<div className="col-span-2">
							<MiniMetric
								compact
								label="Yield"
								tone="positive"
								value={listing.investment.projectedYield}
							/>
						</div>
					</div>
					<p className="mt-5 text-muted-foreground text-sm leading-6">
						{supportingCopy}
					</p>
				</WhiteSurface>
			</section>
		);
	}

	return (
		<section className={className}>
			<SectionLabel>{sectionLabel}</SectionLabel>
			<WhiteSurface
				className={cn("mt-5 px-6 py-6", mobile && "mt-3 px-5 py-5")}
			>
				<div className="flex items-center justify-between gap-4 text-muted-foreground text-sm">
					<span>{availabilityLabel}</span>
					<span>{listing.investment.availabilityLabel}</span>
				</div>
				<div className="mt-4 h-2 rounded-full bg-muted">
					<div
						className="h-full rounded-full bg-[var(--palm)]"
						style={{ width: `${listing.investment.availabilityValue}%` }}
					/>
				</div>
				<div
					className={cn(
						"mt-6 grid gap-4",
						mobile ? "grid-cols-3" : "grid-cols-3"
					)}
				>
					<MiniMetric
						label="Per fraction"
						value={formatCurrency(perFractionAmount)}
					/>
					<MiniMetric
						label={minimumLabel}
						value={`${minimumFractions} frac.`}
					/>
					<MiniMetric
						label="Yield"
						tone="positive"
						value={listing.investment.projectedYield}
					/>
				</div>
				<p className="mt-5 text-muted-foreground text-sm">{supportingCopy}</p>
				{availableFractionsLine ? (
					<p className="mt-2 text-[12px] text-muted-foreground/90">
						{availableFractionsLine}
					</p>
				) : null}
			</WhiteSurface>
		</section>
	);
}

function HostedCheckoutLauncher({
	availableFractions,
	calculatedInvestment,
	canStartCheckout,
	checkout,
	checkoutError,
	ctaLabel,
	fractionError,
	fractionInput,
	fractions,
	guestLawyerEmail,
	guestLawyerFirm,
	guestLawyerName,
	isCheckoutPending,
	isMobile = false,
	lawyerError,
	lawyerMode,
	listingTitle,
	minimumFractions,
	onFractionBlur,
	onFractionChange,
	onGuestLawyerEmailChange,
	onGuestLawyerFirmChange,
	onGuestLawyerNameChange,
	onLawyerModeChange,
	onLsoLawyerSelect,
	onPlatformLawyerSelect,
	onStartCheckout,
	selectedLsoLawyer,
	selectedLawyer,
}: {
	availableFractions: number;
	calculatedInvestment: number;
	canStartCheckout: boolean;
	checkout: NonNullable<ListingDetailData["checkout"]>;
	checkoutError: string | null;
	ctaLabel: string;
	fractionError: string | null;
	fractionInput: string;
	fractions: number;
	guestLawyerEmail: string;
	guestLawyerFirm: string;
	guestLawyerName: string;
	isCheckoutPending: boolean;
	isMobile?: boolean;
	lawyerError: string | null;
	lawyerMode: "guest" | "platform";
	listingTitle: string;
	minimumFractions: number;
	onFractionBlur: () => void;
	onFractionChange: (value: string) => void;
	onGuestLawyerEmailChange: (value: string) => void;
	onGuestLawyerFirmChange: (value: string) => void;
	onGuestLawyerNameChange: (value: string) => void;
	onLawyerModeChange: (value: "guest" | "platform") => void;
	onLsoLawyerSelect: (lsoLawyerId: string) => void;
	onPlatformLawyerSelect: (lawyerId: string) => void;
	onStartCheckout: () => void;
	selectedLsoLawyer?: NonNullable<
		NonNullable<ListingDetailData["checkout"]>["lsoLawyerSearchResults"]
	>[number];
	selectedLawyer?: NonNullable<
		ListingDetailData["checkout"]
	>["lawyers"][number];
}) {
	const idBase = useId();
	const fractionsInputId = `${idBase}-fractions`;
	const guestNameId = `${idBase}-guest-name`;
	const guestEmailId = `${idBase}-guest-email`;
	const guestFirmId = `${idBase}-guest-firm`;
	const lsoLawyers = checkout.lsoLawyerSearchResults ?? [];
	const hasLsoLawyers = lsoLawyers.length > 0;
	const canUseManualGuestFallback =
		checkout.lawyers.length === 0 && !hasLsoLawyers;
	const canUseGuestMode = hasLsoLawyers || canUseManualGuestFallback;
	let lawyerSelection: ReactNode;
	if (lawyerMode === "platform") {
		lawyerSelection =
			checkout.lawyers.length > 0 ? (
				checkout.lawyers.map((lawyer) => (
					<LawyerOptionCard
						isCompact={isMobile}
						isSelected={lawyer.id === selectedLawyer?.id}
						key={lawyer.id}
						lawyer={lawyer}
						onSelect={onPlatformLawyerSelect}
					/>
				))
			) : (
				<EmptySelectionState message="No platform lawyers are available for this listing." />
			);
	} else if (hasLsoLawyers) {
		lawyerSelection = (
			<div className="space-y-3">
				<div className="grid gap-2">
					{lsoLawyers.map((lawyer) => (
						<LsoLawyerOptionCard
							isSelected={lawyer.lsoLawyerId === selectedLsoLawyer?.lsoLawyerId}
							key={lawyer.lsoLawyerId}
							lawyer={lawyer}
							onSelect={onLsoLawyerSelect}
						/>
					))}
				</div>
				{selectedLsoLawyer?.email ? null : (
					<FieldInput
						id={guestEmailId}
						label="Lawyer contact email"
						onChange={onGuestLawyerEmailChange}
						type="email"
						value={guestLawyerEmail}
					/>
				)}
			</div>
		);
	} else if (canUseManualGuestFallback) {
		lawyerSelection = (
			<div className="grid gap-3 sm:grid-cols-2">
				<FieldInput
					id={guestNameId}
					label="Lawyer name"
					onChange={onGuestLawyerNameChange}
					value={guestLawyerName}
				/>
				<FieldInput
					id={guestEmailId}
					label="Lawyer email"
					onChange={onGuestLawyerEmailChange}
					type="email"
					value={guestLawyerEmail}
				/>
				<FieldInput
					className="sm:col-span-2"
					id={guestFirmId}
					label="Law firm"
					onChange={onGuestLawyerFirmChange}
					value={guestLawyerFirm}
				/>
			</div>
		);
	} else {
		lawyerSelection = (
			<EmptySelectionState message="Guest lawyer entry appears only when no platform lawyer or LSO result is available." />
		);
	}

	return (
		<section
			className={cn(
				isMobile
					? "scroll-mt-20 px-5 pt-3"
					: "grid scroll-mt-24 grid-cols-[minmax(0,1fr)_380px] gap-5 px-16 pt-6"
			)}
			id={LOCK_WORKFLOW_SECTION_ID}
		>
			<WhiteSurface className="overflow-hidden">
				<div className="border-border/70 border-b px-5 py-5 sm:px-6">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
						<div className="min-w-0">
							<SectionLabel>Fraction lock</SectionLabel>
							<h2 className="mt-2 font-semibold text-[24px] leading-tight">
								Choose fractions to reserve
							</h2>
						</div>
						<div className="grid grid-cols-2 gap-2 sm:w-[260px]">
							<LockStat
								label="Fractions available"
								value={availableFractions.toLocaleString()}
							/>
							<LockStat label="Lock fee" value={checkout.lockFee.display} />
						</div>
					</div>
				</div>

				<div className="grid gap-5 px-5 py-5 sm:px-6 sm:py-6 xl:grid-cols-[360px_minmax(0,1fr)]">
					<div className={listingDetailSurfaceClasses.mutedCard}>
						<div className="flex items-start justify-between gap-4">
							<div>
								<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
									Fractions to lock
								</p>
								<label className="sr-only" htmlFor={fractionsInputId}>
									Number of fractions
								</label>
							</div>
							<p className={listingDetailSurfaceClasses.primaryPill}>
								{minimumFractions.toLocaleString()} to{" "}
								{availableFractions.toLocaleString()} available
							</p>
						</div>
						<div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
							<div className="min-w-0 space-y-4">
								<Input
									aria-describedby={
										fractionError ? `${fractionsInputId}-error` : undefined
									}
									aria-invalid={fractionError !== null}
									className={cn(
										"h-14 px-4 font-semibold text-[22px]",
										listingDetailSurfaceClasses.formInput
									)}
									id={fractionsInputId}
									inputMode="numeric"
									onBlur={onFractionBlur}
									onChange={(event) => onFractionChange(event.target.value)}
									value={fractionInput}
								/>
								<div className="space-y-2">
									<Slider
										aria-label="Fraction range"
										className="[&_[data-slot=slider-range]]:bg-[var(--palm)] [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:border-[var(--palm)]"
										max={availableFractions}
										min={minimumFractions}
										onValueChange={(values) =>
											onFractionChange(String(values[0] ?? minimumFractions))
										}
										step={1}
										value={[
											effectiveSliderFractions({
												availableFractions,
												fractions,
												minimumFractions,
											}),
										]}
									/>
									<div className="flex items-center justify-between text-[11px] text-muted-foreground">
										<span>{minimumFractions.toLocaleString()}</span>
										<span>{availableFractions.toLocaleString()}</span>
									</div>
								</div>
							</div>
							<div
								className={cn(
									"min-w-[128px] px-4 py-3 text-right",
									listingDetailSurfaceClasses.primaryStat
								)}
							>
								<p className="font-semibold text-[22px] text-[var(--palm)] leading-none">
									{formatCurrency(calculatedInvestment)}
								</p>
								<p className="mt-1 text-[11px] text-muted-foreground">
									Position total
								</p>
							</div>
						</div>
						<p className="mt-3 text-muted-foreground text-xs leading-5">
							FairLend checks availability again before checkout opens.
						</p>
						{fractionError ? (
							<p
								className={cn(
									"mt-3 rounded-lg border px-3 py-2 text-xs",
									listingDetailStateClasses.error
								)}
								id={`${fractionsInputId}-error`}
							>
								{fractionError}
							</p>
						) : null}
					</div>

					<div className={listingDetailSurfaceClasses.mutedCard}>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
									Closing counsel
								</p>
								<p className="mt-1 font-medium text-sm">
									Choose the lawyer representing this lock.
								</p>
							</div>
							<div
								className={cn(
									"grid gap-1",
									listingDetailSurfaceClasses.segmentedControl,
									canUseGuestMode ? "grid-cols-2" : "grid-cols-1"
								)}
							>
								<SegmentButton
									isSelected={lawyerMode === "platform"}
									onClick={() => onLawyerModeChange("platform")}
								>
									Platform lawyer
								</SegmentButton>
								{canUseGuestMode ? (
									<SegmentButton
										isSelected={lawyerMode === "guest"}
										onClick={() => onLawyerModeChange("guest")}
									>
										{hasLsoLawyers ? "LSO lawyer" : "Guest lawyer"}
									</SegmentButton>
								) : null}
							</div>
						</div>

						<div className="mt-4">{lawyerSelection}</div>
						{lawyerError ? (
							<p
								className={cn(
									"mt-3 rounded-lg border px-3 py-2 text-xs",
									listingDetailStateClasses.error
								)}
							>
								{lawyerError}
							</p>
						) : null}
					</div>
				</div>
			</WhiteSurface>

			<HostedCheckoutSummary
				calculatedInvestment={calculatedInvestment}
				canStartCheckout={canStartCheckout}
				checkout={checkout}
				checkoutError={checkoutError}
				ctaLabel={ctaLabel}
				fractions={fractions}
				isCheckoutPending={isCheckoutPending}
				isMobile={isMobile}
				listingTitle={listingTitle}
				onStartCheckout={onStartCheckout}
				selectedLawyerLabel={
					lawyerMode === "guest"
						? selectedLsoLawyer?.displayName ||
							guestLawyerName ||
							"Guest lawyer"
						: selectedLawyer?.label
				}
			/>
		</section>
	);
}

function LockStat({ label, value }: { label: string; value: string }) {
	return (
		<div className={listingDetailSurfaceClasses.lockStat}>
			<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
				{label}
			</p>
			<p className="mt-1 truncate font-semibold text-[18px] text-[var(--palm)] leading-none">
				{value}
			</p>
		</div>
	);
}

function SegmentButton({
	children,
	isSelected,
	onClick,
}: {
	children: ReactNode;
	isSelected: boolean;
	onClick: () => void;
}) {
	return (
		<button
			aria-pressed={isSelected}
			className={cn(
				"h-9 rounded-md px-3 font-medium text-[13px] transition-colors",
				isSelected
					? "bg-card text-foreground shadow-sm"
					: "text-muted-foreground hover:text-foreground"
			)}
			onClick={onClick}
			type="button"
		>
			{children}
		</button>
	);
}

function effectiveSliderFractions({
	availableFractions,
	fractions,
	minimumFractions,
}: {
	availableFractions: number;
	fractions: number;
	minimumFractions: number;
}) {
	return Math.min(Math.max(fractions, minimumFractions), availableFractions);
}

function FieldInput({
	className,
	id,
	label,
	onChange,
	type = "text",
	value,
}: {
	className?: string;
	id: string;
	label: string;
	onChange: (value: string) => void;
	type?: "email" | "text";
	value: string;
}) {
	return (
		<div className={className}>
			<label
				className="font-medium text-[13px] text-muted-foreground"
				htmlFor={id}
			>
				{label}
			</label>
			<Input
				className={cn("mt-1 h-11", listingDetailSurfaceClasses.formInput)}
				id={id}
				onChange={(event) => onChange(event.target.value)}
				type={type}
				value={value}
			/>
		</div>
	);
}

function HostedCheckoutSummary({
	calculatedInvestment,
	canStartCheckout,
	checkout,
	checkoutError,
	ctaLabel,
	fractions,
	isCheckoutPending,
	isMobile,
	listingTitle,
	onStartCheckout,
	selectedLawyerLabel,
}: {
	calculatedInvestment: number;
	canStartCheckout: boolean;
	checkout: NonNullable<ListingDetailData["checkout"]>;
	checkoutError: string | null;
	ctaLabel: string;
	fractions: number;
	isCheckoutPending: boolean;
	isMobile: boolean;
	listingTitle: string;
	onStartCheckout: () => void;
	selectedLawyerLabel?: string;
}) {
	return (
		<aside
			className={cn(
				"shrink-0 overflow-hidden rounded-xl border shadow-sm",
				listingDetailSurfaceClasses.checkoutPanel,
				isMobile ? "mt-4 w-full" : "sticky top-6 self-start"
			)}
		>
			<div
				className={cn(
					"border-b px-5 py-5",
					"border-[color-mix(in_oklab,var(--sand)_12%,transparent)]"
				)}
			>
				<p
					className={cn(
						"font-medium text-[11px] uppercase tracking-[0.18em]",
						listingDetailTextClasses.checkoutLabel
					)}
				>
					Hosted checkout
				</p>
				<div className="mt-4 flex items-end justify-between gap-4">
					<div>
						<p
							className={cn("text-sm", listingDetailTextClasses.checkoutSubtle)}
						>
							Lock fee due today
						</p>
						<p className="mt-1 font-semibold text-[42px] leading-none tracking-[-0.04em]">
							{checkout.lockFee.display}
						</p>
					</div>
					<div
						className={cn(
							"rounded-lg px-3 py-2 text-right",
							listingDetailSurfaceClasses.checkoutInset
						)}
					>
						<p className="font-semibold text-[18px] leading-none">
							{fractions}
						</p>
						<p
							className={cn(
								"mt-1 text-[11px]",
								listingDetailTextClasses.checkoutLabel
							)}
						>
							fractions
						</p>
					</div>
				</div>
			</div>

			<div className="space-y-4 px-5 py-5">
				<div
					className={cn(
						"space-y-3 rounded-lg border p-4 text-sm",
						listingDetailSurfaceClasses.checkoutInset
					)}
				>
					<CheckoutRow label="Listing" value={listingTitle} />
					<CheckoutRow
						label="Position total"
						value={formatCurrency(calculatedInvestment)}
					/>
					<CheckoutRow
						label="Closing counsel"
						value={selectedLawyerLabel ?? "No lawyer selected"}
					/>
				</div>

				<Button
					className={cn(
						"inline-flex h-auto min-h-12 w-full items-center justify-center gap-2 whitespace-normal rounded-lg px-4 py-3 font-semibold",
						listingDetailActionClasses.checkoutCta
					)}
					disabled={!canStartCheckout || isCheckoutPending}
					onClick={onStartCheckout}
					type="button"
				>
					{isCheckoutPending ? (
						<>
							<Loader2 className="size-4 animate-spin" />
							Opening checkout
						</>
					) : (
						<>
							<ExternalLink className="size-4" />
							{ctaLabel}
						</>
					)}
				</Button>

				{checkoutError ? (
					<div
						className={cn(
							"flex gap-2 rounded-lg border px-3 py-3 text-sm",
							listingDetailStateClasses.error
						)}
					>
						<AlertCircle className="mt-0.5 size-4 shrink-0" />
						<p>{checkoutError}</p>
					</div>
				) : null}

				<p
					className={cn(
						"text-[12px] leading-5",
						listingDetailTextClasses.checkoutMeta
					)}
				>
					Stripe collects the lock fee only after FairLend confirms the selected
					fractions are still available.
				</p>
			</div>
		</aside>
	);
}

function SimilarListingsSection({
	buildHref,
	cards,
	className,
	mobile = false,
	title,
}: {
	buildHref: (listingId: string) => string;
	cards: ListingSimilarCard[];
	className?: string;
	mobile?: boolean;
	title: string;
}) {
	return (
		<section className={cn(className)}>
			<SectionLabel>{title}</SectionLabel>
			<div
				className={cn(
					"mt-5 gap-4",
					mobile ? "flex overflow-x-auto pb-2" : "grid grid-cols-3"
				)}
			>
				{cards.map((card) => (
					<a
						className={cn(
							"group overflow-hidden transition-transform duration-300 ease-out hover:-translate-y-0.5",
							listingDetailSurfaceClasses.island,
							mobile ? "w-[220px] shrink-0" : "min-w-0"
						)}
						href={card.href ?? buildHref(card.id)}
						key={card.id}
					>
						<div className="h-[138px] overflow-hidden">
							<MediaPanel
								className="h-full rounded-none"
								image={{
									id: card.id,
									label: card.title,
									alt: card.title,
									url: card.imageUrl,
									tone: card.tone,
								}}
							/>
						</div>
						<div className="space-y-3 px-4 py-4">
							<div className="flex flex-wrap gap-1.5">
								{card.badges.map((badge) => (
									<BadgePill badge={badge} key={badge.id} mobile />
								))}
							</div>
							<div className="space-y-1">
								<p className="font-medium leading-6">{card.title}</p>
								<div className="flex flex-wrap gap-2 text-muted-foreground text-sm">
									<span className="font-medium text-foreground">
										{card.price}
									</span>
									{card.metrics.map((metric) => (
										<span key={metric}>{metric}</span>
									))}
								</div>
							</div>
						</div>
					</a>
				))}
			</div>
		</section>
	);
}

function ListingDetailMapPopup({ listing }: { listing: ListingDetailData }) {
	return (
		<div
			className={cn(
				"w-[min(280px,calc(100vw-3rem))]",
				listingDetailSurfaceClasses.popover
			)}
		>
			<p className="line-clamp-2 font-semibold text-sm">{listing.title}</p>
			<p className="mt-1 flex items-center gap-1 text-muted-foreground text-xs">
				<MapPin aria-hidden="true" className="size-3 shrink-0" />
				{listing.map.locationText}
			</p>
			<p className="mt-2 text-[11px] text-muted-foreground leading-snug">
				{listing.map.label}
			</p>
		</div>
	);
}

function MapPanel({
	className,
	listing,
	mapPanelId,
}: {
	className?: string;
	listing: ListingDetailData;
	mapPanelId?: string;
}) {
	const mapItems = useMemo(() => {
		if (
			!(Number.isFinite(listing.map.lat) && Number.isFinite(listing.map.lng))
		) {
			return [] as Array<{ id: string; lat: number; lng: number }>;
		}

		return [
			{
				id: listing.id,
				lat: listing.map.lat as number,
				lng: listing.map.lng as number,
			},
		];
	}, [listing.id, listing.map.lat, listing.map.lng]);

	const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;

	const shellClass = cn(
		"flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl",
		className
	);

	if (!mapboxToken) {
		return (
			<div className={shellClass} id={mapPanelId}>
				<ListingMap
					className="min-h-0 flex-1"
					containerClassName="h-full min-h-0 flex-1"
					items={[]}
					mapClassName="min-h-0 flex-1"
					renderPopup={() => null}
				/>
			</div>
		);
	}

	if (mapItems.length === 0) {
		return (
			<div
				className={cn(listingDetailSurfaceClasses.mapUnavailable, className)}
				id={mapPanelId}
			>
				<div className={listingDetailSurfaceClasses.mapUnavailableMarker}>
					<div className="size-2 rounded-full bg-[var(--lagoon)]" />
				</div>
				<div className="space-y-1">
					<p className="font-medium text-foreground text-sm">
						Map location not published
					</p>
					<p className="max-w-[28ch] text-muted-foreground text-xs leading-relaxed">
						Precise coordinates are not available for this listing. Area shown
						as text only.
					</p>
					<p className="text-muted-foreground text-sm">
						{listing.map.label} · {listing.map.locationText}
					</p>
				</div>
			</div>
		);
	}

	const point = mapItems[0];
	return (
		<div className={shellClass} id={mapPanelId}>
			<ListingMap
				className="min-h-0 flex-1"
				containerClassName="h-full min-h-0 flex-1"
				initialCenter={{ lat: point.lat, lng: point.lng }}
				initialZoom={12}
				items={mapItems}
				key={listing.id}
				mapClassName="min-h-0 flex-1"
				renderPopup={() => <ListingDetailMapPopup listing={listing} />}
			/>
		</div>
	);
}

function MediaPanel({
	className,
	compact = false,
	image,
}: {
	className?: string;
	compact?: boolean;
	image?: ListingHeroImage;
}) {
	return (
		<div
			className={cn(
				listingDetailSurfaceClasses.mediaFallback,
				image
					? listingDetailHeroToneClasses[image.tone]
					: listingDetailHeroToneClasses.stone,
				className
			)}
		>
			{image?.url ? (
				<img
					alt={image.alt}
					className="h-full w-full object-cover"
					height={675}
					src={image.url}
					width={1200}
				/>
			) : (
				<div className="flex flex-col items-center gap-3 text-muted-foreground">
					<ImageIcon className={cn("size-10", compact && "size-6")} />
					<span
						className={cn("font-medium", compact ? "text-[11px]" : "text-base")}
					>
						{image?.label ?? "No photos available"}
					</span>
				</div>
			)}
		</div>
	);
}

function EmptySelectionState({ message }: { message: string }) {
	return (
		<div
			className={cn(
				"border-dashed px-4 py-4 text-muted-foreground text-sm",
				listingDetailSurfaceClasses.island
			)}
		>
			{message}
		</div>
	);
}

function buildSelectedLawyerSnapshot({
	guestEmail,
	guestFirm,
	guestName,
	lawyerMode,
	selectedLsoLawyer,
	selectedLawyer,
}: {
	guestEmail: string;
	guestFirm: string;
	guestName: string;
	lawyerMode: "guest" | "platform";
	selectedLsoLawyer?: NonNullable<
		NonNullable<ListingDetailData["checkout"]>["lsoLawyerSearchResults"]
	>[number];
	selectedLawyer?: NonNullable<
		ListingDetailData["checkout"]
	>["lawyers"][number];
}): ListingCheckoutSelectedLawyer | null {
	if (lawyerMode === "guest") {
		if (selectedLsoLawyer) {
			if (!selectedLsoLawyer.selectable) {
				return null;
			}
			const contactEmail = selectedLsoLawyer.email ?? guestEmail.trim();
			if (!EMAIL_PATTERN.test(contactEmail)) {
				return null;
			}
			return {
				type: "guest_lawyer",
				source: "lso_search",
				name: selectedLsoLawyer.displayName,
				email: contactEmail,
				...(selectedLsoLawyer.firmName
					? { firm: selectedLsoLawyer.firmName }
					: {}),
				lso: {
					barNumber: selectedLsoLawyer.barNumber,
					jurisdiction: selectedLsoLawyer.jurisdiction,
					licensingStatus: selectedLsoLawyer.licensingStatus,
					lsoLawyerId: selectedLsoLawyer.lsoLawyerId,
					restrictionStatus: selectedLsoLawyer.restrictionStatus,
					...(selectedLsoLawyer.restrictionSummary
						? { restrictionSummary: selectedLsoLawyer.restrictionSummary }
						: {}),
					source: selectedLsoLawyer.source,
					sourceFetchedAt: selectedLsoLawyer.sourceFetchedAt,
				},
			};
		}
		const name = guestName.trim();
		const email = guestEmail.trim();
		const firm = guestFirm.trim();
		if (name.length === 0 || !EMAIL_PATTERN.test(email)) {
			return null;
		}
		return {
			type: "guest_lawyer",
			source: "manual",
			name,
			email,
			...(firm.length > 0 ? { firm } : {}),
		};
	}

	if (!selectedLawyer) {
		return null;
	}
	if (!(selectedLawyer.id && selectedLawyer.email)) {
		return null;
	}

	return {
		type: "platform_lawyer",
		lawyerId: selectedLawyer.id,
		name: selectedLawyer.label,
		email: selectedLawyer.email,
		...(selectedLawyer.firm ? { firm: selectedLawyer.firm } : {}),
		...(selectedLawyer.barNumber || selectedLawyer.jurisdiction
			? {
					lso: {
						...(selectedLawyer.barNumber
							? { barNumber: selectedLawyer.barNumber }
							: {}),
						...(selectedLawyer.jurisdiction
							? { jurisdiction: selectedLawyer.jurisdiction }
							: {}),
					},
				}
			: {}),
	};
}

function getLawyerError({
	lawyerMode,
	selectedLawyerSnapshot,
	selectedLsoLawyer,
}: {
	lawyerMode: "guest" | "platform";
	selectedLawyerSnapshot: ListingCheckoutSelectedLawyer | null;
	selectedLsoLawyer?: NonNullable<
		NonNullable<ListingDetailData["checkout"]>["lsoLawyerSearchResults"]
	>[number];
}): string | null {
	if (selectedLawyerSnapshot !== null) {
		return null;
	}
	if (lawyerMode === "guest") {
		if (selectedLsoLawyer && !selectedLsoLawyer.selectable) {
			return "Select an eligible LSO lawyer.";
		}
		if (selectedLsoLawyer && !selectedLsoLawyer.email) {
			return "Enter a contact email for the selected LSO lawyer.";
		}
		return "Enter a guest lawyer name and valid email.";
	}
	return "Select a platform lawyer.";
}

function CheckoutReturnStateBanner({
	className,
	state,
}: {
	className?: string;
	state?: ListingCheckoutReturnState;
}) {
	if (!state) {
		return null;
	}

	const content: Record<
		ListingCheckoutReturnState,
		{ heading: string; message: string; tone: "error" | "success" | "warning" }
	> = {
		abandoned: {
			heading: "Checkout canceled",
			message:
				"No deal was created. If a temporary lock exists, FairLend will release it automatically.",
			tone: "warning",
		},
		error: {
			heading: "Checkout status not confirmed",
			message: "Refresh this listing before starting another lock.",
			tone: "error",
		},
		expired: {
			heading: "Checkout expired",
			message: "The checkout window expired. No lock is active.",
			tone: "warning",
		},
		provider_start_failed: {
			heading: "Hosted checkout could not open",
			message:
				"Stripe did not start a checkout session. No lock fee was collected.",
			tone: "error",
		},
		success_pending: {
			heading: "Checkout received",
			message:
				"FairLend is confirming the Stripe result. The deal will appear when confirmation finishes.",
			tone: "success",
		},
	};
	const selected = content[state];

	return (
		<section className={className}>
			<div
				className={cn(
					"flex gap-3 rounded-xl border px-4 py-4 text-sm",
					selected.tone === "success" && listingDetailStateClasses.success,
					selected.tone === "warning" && listingDetailStateClasses.warning,
					selected.tone === "error" && listingDetailStateClasses.error
				)}
				role="status"
			>
				<AlertCircle className="mt-0.5 size-4 shrink-0" />
				<div>
					<p className="font-semibold">{selected.heading}</p>
					<p className="mt-1 leading-6">{selected.message}</p>
				</div>
			</div>
		</section>
	);
}

function ReadOnlyMarketplaceNotice({
	availableFractions,
	className,
	reason,
	totalFractions,
}: {
	availableFractions: number;
	className?: string;
	reason?: string | null;
	totalFractions: number;
}) {
	return (
		<section className={className}>
			<WhiteSurface className="px-6 py-6">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
					<div className="space-y-2">
						<SectionLabel>Read-only listing</SectionLabel>
						<h2 className="font-semibold text-[22px] leading-tight">
							Review only, locking disabled
						</h2>
						<p className="max-w-2xl text-muted-foreground text-sm leading-6">
							{reason ??
								"Availability is current. This listing is open for review only, so fraction reservation, lawyer selection, and checkout are disabled."}
						</p>
					</div>
					<div className={listingDetailSurfaceClasses.readOnlyMetric}>
						<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
							Fractions available
						</p>
						<p className="mt-2 font-semibold text-[34px] text-[var(--palm)] leading-none tracking-[-0.04em]">
							{availableFractions.toLocaleString()}
						</p>
						<p className="mt-1 text-muted-foreground text-sm">
							of {totalFractions.toLocaleString()} total
						</p>
					</div>
				</div>
			</WhiteSurface>
		</section>
	);
}

function WhiteSurface({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn(listingDetailSurfaceClasses.island, className)}>
			{children}
		</div>
	);
}

function MetricCard({
	item,
}: {
	item: ListingDetailData["keyFinancials"][number];
}) {
	return (
		<WhiteSurface className="px-5 py-5">
			<p className="text-muted-foreground text-sm">{item.label}</p>
			<p
				className={cn(
					"mt-2 font-semibold text-[34px] leading-none tracking-[-0.04em]",
					listingDetailValueToneClasses[item.tone ?? "default"]
				)}
			>
				{item.value}
			</p>
			<p className="mt-2 text-muted-foreground/90 text-sm">{item.note}</p>
		</WhiteSurface>
	);
}

function CompactMetricCard({
	item,
}: {
	item: ListingDetailData["keyFinancials"][number];
}) {
	return (
		<WhiteSurface className="min-w-0 px-4 py-4">
			<p className="text-[12px] text-muted-foreground">{item.label}</p>
			<p
				className={cn(
					MOBILE_METRIC_VALUE_CLASS,
					listingDetailValueToneClasses[item.tone ?? "default"]
				)}
				title={item.value}
			>
				{item.value}
			</p>
		</WhiteSurface>
	);
}

function MobileComparablesSection({ listing }: { listing: ListingDetailData }) {
	const hasAsIfAppraisal = hasPublishedAsIfAppraisal(listing);

	return (
		<ListingScrollReveal className="px-5 pt-6">
			<SectionLabel>Comparable Properties</SectionLabel>
			<div className="mt-3 space-y-3">
				<MobileComparableList
					rows={listing.comparables.asIs}
					title="As-is comparables"
				/>
				{hasAsIfAppraisal ? (
					<MobileComparableList
						projected
						rows={listing.comparables.asIf}
						title="As-if comparables"
					/>
				) : null}
			</div>
		</ListingScrollReveal>
	);
}

function MobileComparableList({
	projected = false,
	rows,
	title,
}: {
	projected?: boolean;
	rows: ListingComparable[];
	title: string;
}) {
	return (
		<WhiteSurface className={cn("px-4 py-4", projected && "border-dashed")}>
			<div className="flex items-center justify-between gap-3">
				<h2 className="font-semibold text-[18px] leading-tight">{title}</h2>
				<span className="text-muted-foreground text-xs">
					{rows.length.toLocaleString()} sales
				</span>
			</div>
			{rows.length > 0 ? (
				<div className="mt-3 space-y-2">
					{rows.map((row) => (
						<ComparableMobileCard key={row.id} row={row} />
					))}
				</div>
			) : (
				<ComparableEmptyState projected={projected} />
			)}
		</WhiteSurface>
	);
}

function ComparableMobileCard({ row }: { row: ListingComparable }) {
	return (
		<div className="rounded-lg border border-border/70 bg-background/35 px-3 py-3">
			{row.evidenceAssets?.some((asset) => asset.kind === "image") ? (
				<div className="mb-3 grid grid-cols-2 gap-2">
					{row.evidenceAssets
						.filter((asset) => asset.kind === "image")
						.slice(0, 2)
						.map((asset) => (
							<img
								alt={asset.label}
								className="h-24 w-full rounded-md border border-border/60 object-cover"
								height={96}
								key={asset.url}
								src={asset.url}
								width={240}
							/>
						))}
				</div>
			) : null}
			<div className="flex items-start justify-between gap-3">
				<p className="min-w-0 font-medium text-[14px] leading-5">
					{row.address}
				</p>
				<p className="shrink-0 font-semibold text-[15px] tabular-nums">
					{row.price}
				</p>
			</div>
			<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs">
				<span>{row.date}</span>
				<span>{row.distance}</span>
				<span>{row.squareFeet}</span>
			</div>
			<ComparableEvidenceLinks row={row} />
		</div>
	);
}

function ComparableEmptyState({ projected }: { projected?: boolean }) {
	return (
		<div className="mt-3 rounded-lg border border-border/80 border-dashed bg-muted/25 px-4 py-5 text-center">
			<div className="mx-auto flex size-11 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-[var(--palm)]">
				<Building2 className="size-5" />
			</div>
			<p className="mt-3 font-semibold text-[15px]">
				No comparable properties published
			</p>
			<p className="mx-auto mt-1 max-w-[28ch] text-muted-foreground text-sm leading-6">
				{projected
					? "As-if comparables will appear when the appraisal package includes projected sales evidence."
					: "FairLend has not published comparable sales evidence for this appraisal yet."}
			</p>
		</div>
	);
}

function ComparableTable({
	projected = false,
	rows,
	title,
}: {
	projected?: boolean;
	rows: ListingComparable[];
	title: string;
}) {
	return (
		<WhiteSurface className={cn("px-5 py-5", projected && "border-dashed")}>
			<div className="flex items-center gap-2">
				<h2 className="font-semibold text-[20px]">{title}</h2>
				{projected ? (
					<span
						className={cn(
							"font-semibold text-[10px] uppercase tracking-[0.24em]",
							listingDetailTextClasses.warning
						)}
					>
						Projected
					</span>
				) : null}
			</div>
			<div className="mt-4 overflow-hidden rounded-lg border border-border/70">
				<div className={listingDetailSurfaceClasses.tableHeader}>
					<span>Address</span>
					<span>Price</span>
					<span>Date</span>
					<span>Dist.</span>
					<span>Sq Ft</span>
				</div>
				{rows.length > 0 ? (
					rows.map((row) => (
						<div className={listingDetailSurfaceClasses.tableRow} key={row.id}>
							<span>
								<span>{row.address}</span>
								<ComparableEvidenceLinks row={row} />
							</span>
							<span>{row.price}</span>
							<span>{row.date}</span>
							<span>{row.distance}</span>
							<span>{row.squareFeet}</span>
						</div>
					))
				) : (
					<div className="border-border/60 border-t px-4 py-6 text-muted-foreground text-sm">
						No comparable sales are published for this appraisal.
					</div>
				)}
			</div>
		</WhiteSurface>
	);
}

function ComparableEvidenceLinks({ row }: { row: ListingComparable }) {
	if (!row.evidenceAssets?.length) {
		return null;
	}

	return (
		<div className="mt-2 flex flex-wrap gap-1.5">
			{row.evidenceAssets.map((asset) => (
				<a
					className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/70 px-2 py-1 text-[11px] text-foreground/80 transition hover:border-[var(--palm)] hover:text-[var(--palm)]"
					href={asset.url}
					key={`${asset.kind}:${asset.url}`}
					rel="noopener noreferrer"
					target="_blank"
				>
					{asset.kind === "image" ? (
						<ImageIcon className="size-3" />
					) : (
						<FileText className="size-3" />
					)}
					<span>{asset.label}</span>
					<ExternalLink className="size-3" />
				</a>
			))}
		</div>
	);
}

function SignalRow({ item }: { item: ListingBorrowerSignal }) {
	return (
		<div className="flex items-center justify-between gap-4">
			<span className="text-[15px] text-foreground/90">{item.label}</span>
			<span
				className={cn(
					"inline-flex items-center rounded-full font-medium text-sm",
					item.value === "Approved"
						? cn("px-3 py-1", listingDetailBadgeClasses.positive)
						: listingDetailValueToneClasses[item.tone]
				)}
			>
				{item.value}
			</span>
		</div>
	);
}

function LawyerOptionCard({
	isCompact = false,
	isSelected,
	lawyer,
	onSelect,
}: {
	isCompact?: boolean;
	isSelected: boolean;
	lawyer: NonNullable<ListingDetailData["checkout"]>["lawyers"][number];
	onSelect: (lawyerId: string) => void;
}) {
	const availability = lawyer.availability?.slice(0, 5) ?? [];
	const capacityWarning =
		lawyer.capacityWarning && lawyer.capacityWarning !== "none"
			? capacityWarningLabel(lawyer.capacityWarning)
			: null;
	return (
		<button
			aria-pressed={isSelected}
			className={cn(
				listingDetailSurfaceClasses.selectableCardBase,
				isSelected
					? listingDetailSurfaceClasses.selectableCardSelected
					: listingDetailSurfaceClasses.selectableCardIdle,
				isCompact && "px-4 py-3"
			)}
			onClick={() => onSelect(lawyer.id)}
			type="button"
		>
			<div
				className={cn(
					"mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
					isSelected
						? listingDetailSurfaceClasses.selectionIndicatorSelected
						: listingDetailSurfaceClasses.selectionIndicatorIdle
				)}
			>
				<Check className="size-3" />
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<p className="font-medium text-sm">{lawyer.label}</p>
					{lawyer.slaTier ? (
						<span
							className={cn(
								"rounded-full px-2 py-0.5 font-medium text-[11px]",
								listingDetailBadgeClasses.positive
							)}
						>
							{lawyer.slaTier.reviewHours}h SLA
						</span>
					) : null}
				</div>
				<p className="mt-1 text-[13px] text-muted-foreground">
					{lawyer.firm ? `${lawyer.firm} · ${lawyer.detail}` : lawyer.detail}
				</p>
				{availability.length > 0 ? (
					<div className="mt-3 flex flex-wrap gap-1.5">
						{availability.map((day) => (
							<span
								className={cn(
									"rounded-full px-2 py-1 text-[11px]",
									day.hasAvailability
										? listingDetailBadgeClasses.positive
										: listingDetailBadgeClasses.error
								)}
								key={day.businessDate}
							>
								{day.label}
							</span>
						))}
					</div>
				) : null}
				<div className="mt-3 flex flex-wrap gap-2 text-[12px] text-muted-foreground">
					{lawyer.activeDealCount !== undefined ? (
						<span>
							{lawyer.activeDealCount.toLocaleString()} active
							{lawyer.capacityLimit !== undefined
								? ` / ${lawyer.capacityLimit.toLocaleString()} capacity`
								: ""}
						</span>
					) : null}
					{capacityWarning ? (
						<span className="font-medium text-[color-mix(in_oklab,var(--palm)_58%,var(--destructive))]">
							{capacityWarning}
						</span>
					) : null}
				</div>
			</div>
		</button>
	);
}

function LsoLawyerOptionCard({
	isSelected,
	lawyer,
	onSelect,
}: {
	isSelected: boolean;
	lawyer: NonNullable<
		NonNullable<ListingDetailData["checkout"]>["lsoLawyerSearchResults"]
	>[number];
	onSelect: (lsoLawyerId: string) => void;
}) {
	return (
		<button
			aria-disabled={!lawyer.selectable}
			aria-pressed={isSelected}
			className={cn(
				listingDetailSurfaceClasses.selectableCardBase,
				isSelected
					? listingDetailSurfaceClasses.selectableCardSelected
					: listingDetailSurfaceClasses.selectableCardIdle,
				!lawyer.selectable && listingDetailSurfaceClasses.selectableCardDisabled
			)}
			disabled={!lawyer.selectable}
			onClick={() => onSelect(lawyer.lsoLawyerId)}
			type="button"
		>
			<div
				className={cn(
					"mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
					isSelected
						? listingDetailSurfaceClasses.selectionIndicatorSelected
						: listingDetailSurfaceClasses.selectionIndicatorIdle
				)}
			>
				<Check className="size-3" />
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<p className="font-medium text-sm">{lawyer.displayName}</p>
					<span
						className={cn(
							"rounded-full px-2 py-0.5 font-medium text-[11px]",
							lawyer.selectable
								? listingDetailBadgeClasses.positive
								: listingDetailBadgeClasses.error
						)}
					>
						{lawyer.selectable ? "LSO clear" : "Not selectable"}
					</span>
				</div>
				<p className="mt-1 text-[13px] text-muted-foreground">
					{lawyer.firmName ?? "Independent counsel"} · {lawyer.barNumber} ·{" "}
					{lawyer.jurisdiction}
				</p>
				{lawyer.restrictionSummary ? (
					<p className="mt-2 text-destructive text-xs">
						{lawyer.restrictionSummary}
					</p>
				) : null}
			</div>
		</button>
	);
}

function capacityWarningLabel(
	warning: NonNullable<ListingLawyerOption["capacityWarning"]>
): string {
	const labels = {
		approaching: "Capacity filling",
		full: "Fully booked",
		none: "",
		over_capacity: "Over capacity",
	} satisfies Record<
		NonNullable<ListingLawyerOption["capacityWarning"]>,
		string
	>;
	return labels[warning];
}

function SectionLabel({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<p className={cn(listingDetailTextClasses.sectionLabel, className)}>
			{children}
		</p>
	);
}

function buildAdminDetailHref(link: ListingAdminQuickLink) {
	const host =
		typeof window === "undefined"
			? FAIRLEND_ADMIN_PRODUCTION_HOST
			: window.location.host;
	const hostType = resolvePortalHostTypeFromHost(host);
	const adminHost =
		hostType === "local"
			? FAIRLEND_ADMIN_LOCAL_HOST
			: FAIRLEND_ADMIN_PRODUCTION_HOST;

	return buildAbsoluteHostUrl(
		adminHost,
		`/admin/${link.entityType}/${link.id}`
	);
}

function AdminQuickLinksMenu({
	links,
	mobile = false,
}: {
	links: ListingAdminQuickLink[];
	mobile?: boolean;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					className={cn(
						"h-7 rounded-full border-border/80 px-2.5 font-medium text-[11px]",
						mobile && "h-7 px-2"
					)}
					size="sm"
					type="button"
					variant="outline"
				>
					<ExternalLink className="size-3.5" />
					Admin
					<ChevronDown className="size-3.5 text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56">
				{links.map((link) => (
					<DropdownMenuItem asChild key={`${link.entityType}:${link.id}`}>
						<a href={buildAdminDetailHref(link)}>
							<span>{link.label}</span>
							<span className="ml-auto max-w-24 truncate font-mono text-[10px] text-muted-foreground">
								{link.id}
							</span>
						</a>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function BadgePill({
	badge,
	mobile = false,
}: {
	badge: ListingBadge;
	mobile?: boolean;
}) {
	const label = formatBadgeLabel(badge.label);

	if (badge.tone === "dark") {
		return (
			<Badge
				className={cn(
					"px-2.5 py-1 text-[11px] leading-none tracking-[0.01em]",
					listingDetailBadgeClasses.dark,
					mobile && "text-[11px]"
				)}
			>
				{label}
			</Badge>
		);
	}

	return (
		<Badge
			className={cn(
				"px-2.5 py-1 text-[11px] leading-none tracking-[0.01em]",
				listingDetailSurfaceClasses.outlineBadge,
				mobile && "text-[11px]"
			)}
			variant="outline"
		>
			{label}
		</Badge>
	);
}

function HeroArrowButton({
	ariaLabel,
	className,
	disabled = false,
	direction,
	onClick,
}: {
	ariaLabel: string;
	className?: string;
	disabled?: boolean;
	direction: "left" | "right";
	onClick: () => void;
}) {
	const Icon = direction === "left" ? ChevronLeft : ChevronRight;
	return (
		<button
			aria-label={ariaLabel}
			className={cn(listingDetailActionClasses.heroArrow, className)}
			disabled={disabled}
			onClick={onClick}
			type="button"
		>
			<Icon className="size-4" />
		</button>
	);
}

function MetricSummary({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className="font-semibold text-[40px] text-foreground leading-none tracking-[-0.04em]">
				{value}
			</p>
			<p className="mt-1 text-muted-foreground text-sm">{label}</p>
		</div>
	);
}

function UpcomingPaymentCallout({ listing }: { listing: ListingDetailData }) {
	const nextPayment = listing.paymentHistory.nextUpcoming;

	return (
		<div className={cn("mt-5", listingDetailSurfaceClasses.mutedPanel)}>
			<div className="flex items-start justify-between gap-4">
				<div>
					<p className="font-medium text-[13px] text-muted-foreground">
						Next Upcoming Payment
					</p>
					<p className="mt-2 font-semibold text-[26px] leading-none tracking-[-0.03em]">
						{nextPayment.amount}
					</p>
				</div>
				<span
					className={cn(
						"rounded-full px-3 py-1 font-semibold text-[10px] uppercase tracking-[0.16em]",
						upcomingPaymentStatusClass(nextPayment.status)
					)}
				>
					{nextPayment.statusLabel}
				</span>
			</div>
			<p className="mt-3 text-muted-foreground text-sm">{nextPayment.date}</p>
		</div>
	);
}

function MiniMetric({
	compact = false,
	label,
	tone = "default",
	value,
}: {
	compact?: boolean;
	label: string;
	tone?: ListingValueTone;
	value: string;
}) {
	return (
		<div className="min-w-0">
			<p className="text-muted-foreground text-sm">{label}</p>
			<p
				className={cn(
					compact
						? MOBILE_METRIC_VALUE_CLASS
						: "mt-1 font-semibold text-[30px] leading-none tracking-[-0.04em]",
					listingDetailValueToneClasses[tone]
				)}
				title={value}
			>
				{value}
			</p>
		</div>
	);
}

function InfoColumn({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
				{label}
			</p>
			<p className="mt-2 text-[15px] text-foreground/90">{value}</p>
		</div>
	);
}

function LegendChip({ color, label }: { color: string; label: string }) {
	return (
		<div className="flex items-center gap-1.5">
			<span className={cn("size-2 rounded-full", color)} />
			<span className="text-muted-foreground">{label}</span>
		</div>
	);
}

function CheckoutRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="grid grid-cols-[86px_minmax(0,1fr)] items-start gap-3">
			<span className={listingDetailTextClasses.checkoutLabel}>{label}</span>
			<span
				className="min-w-0 text-right font-medium text-[var(--sand)] leading-5"
				title={value}
			>
				{value}
			</span>
		</div>
	);
}

function monthStatusClass(
	status: ListingDetailData["paymentHistory"]["months"][number]["status"]
) {
	switch (status) {
		case "late":
			return listingDetailPaymentClasses.late;
		case "missed":
			return "bg-destructive text-destructive-foreground";
		case "onTime":
			return listingDetailPaymentClasses.onTime;
		default:
			return "bg-muted text-foreground";
	}
}

function upcomingPaymentStatusClass(
	status: ListingDetailData["paymentHistory"]["nextUpcoming"]["status"]
) {
	switch (status) {
		case "overdue":
			return listingDetailStateClasses.upcomingOverdue;
		case "due":
		case "executing":
			return cn(
				listingDetailStateClasses.upcomingDue,
				listingDetailTextClasses.warning
			);
		case "planned":
			return cn(
				listingDetailStateClasses.upcomingPlanned,
				listingDetailBadgeClasses.positive
			);
		default:
			return "bg-muted text-muted-foreground";
	}
}

function splitSummary(summary: string) {
	const sentences = summary.split(". ").map((sentence) => sentence.trim());
	if (sentences.length < 3) {
		return [summary];
	}

	return [
		`${sentences.slice(0, 2).join(". ")}.`,
		`${sentences.slice(2).join(". ")}`.trim(),
	].filter(Boolean);
}

function formatBadgeLabel(label: string) {
	return label.replace(
		ORDINAL_MORTGAGE_BADGE_PATTERN,
		(_, number: string, suffix: string) =>
			`${number}${suffix.toLowerCase()} mortgage`
	);
}

function formatCurrency(amount: number) {
	return new Intl.NumberFormat("en-CA", {
		style: "currency",
		currency: "CAD",
		maximumFractionDigits: 0,
	}).format(amount);
}

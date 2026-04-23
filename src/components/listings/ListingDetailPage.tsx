"use client";

import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import {
	ArrowLeft,
	Check,
	ChevronLeft,
	ChevronRight,
	FileText,
	Heart,
	ImageIcon,
	MapPin,
	MapPinned,
} from "lucide-react";
import {
	type ReactNode,
	useEffect,
	useId,
	useMemo,
	useState,
} from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { cn } from "#/lib/utils";
import { ListingMap } from "./ListingMap";
import type {
	ListingBadge,
	ListingBorrowerSignal,
	ListingComparable,
	ListingDetailData,
	ListingDocumentItem,
	ListingHeroImage,
	ListingSimilarCard,
	ListingValueTone,
} from "./listing-detail-types";

const HERO_TONE_CLASSES: Record<ListingHeroImage["tone"], string> = {
	mist: "bg-linear-to-br from-stone-100 via-stone-50 to-stone-200",
	pearl: "bg-linear-to-br from-neutral-100 via-stone-50 to-stone-200",
	sage: "bg-linear-to-br from-emerald-50 via-stone-100 to-stone-200",
	sand: "bg-linear-to-br from-amber-50 via-stone-100 to-stone-200",
	stone: "bg-linear-to-br from-stone-200 via-stone-100 to-stone-300",
	warm: "bg-linear-to-br from-orange-50 via-stone-100 to-stone-200",
};

const VALUE_TONE_CLASSES: Record<ListingValueTone, string> = {
	default: "text-foreground",
	positive: "text-[var(--palm)]",
	warning: "text-amber-800 dark:text-amber-400",
};

const DIGITS_ONLY_PATTERN = /^\d+$/;

/** Frosted panels: coherent on gradient page bg + dark mode; avoids flat white slabs. */
const LISTING_ISLAND_CLASS =
	"rounded-xl border border-border/80 bg-card/90 text-card-foreground shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-card/78 dark:border-border/60 dark:bg-card/70 dark:supports-[backdrop-filter]:bg-card/52";

const LISTING_HEADER_CLASS =
	"border-border/80 bg-card/75 backdrop-blur-lg supports-[backdrop-filter]:bg-card/65 dark:bg-card/60 dark:supports-[backdrop-filter]:bg-card/48";

const LISTING_REVEAL_EASE = [0.22, 1, 0.36, 1] as const;
const LISTING_REVEAL_TRANSITION = {
	duration: 0.44,
	ease: LISTING_REVEAL_EASE,
};

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
export type ListingsIndexTo = "/listings" | "/demo/listings";

interface ListingDetailPageProps {
	buildSimilarListingHref?: (listingId: string) => string;
	listing: ListingDetailData;
	listingsIndexTo?: ListingsIndexTo;
	mode?: ListingDetailPageMode;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Large component intentionally composes many presentation controls for read-only and interactive paths.
export function ListingDetailPage({
	listingsIndexTo = "/demo/listings",
	buildSimilarListingHref = (listingId) => `${listingsIndexTo}/${listingId}`,
	listing,
	mode = "interactive",
}: ListingDetailPageProps) {
	const checkout = listing.checkout;
	const isInteractive = mode === "interactive" && checkout !== undefined;
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
	const [fractionInput, setFractionInput] = useState(String(defaultFractions));
	const [showMobileMap, setShowMobileMap] = useState(false);
	const [checkoutSubmitted, setCheckoutSubmitted] = useState(false);
	const firstHeroImageId = listing.heroImages[0]?.id;
	const firstDocumentId = listing.documents[0]?.id;
	const firstLawyerId = checkout?.lawyers[0]?.id;

	useEffect(() => {
		setSelectedImageId(firstHeroImageId);
		setSelectedDocumentId(firstDocumentId);
		setSelectedLawyerId(firstLawyerId);
		setFractionInput(String(defaultFractions));
		setShowMobileMap(false);
		setCheckoutSubmitted(false);
	}, [defaultFractions, firstDocumentId, firstHeroImageId, firstLawyerId]);

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
	const availableFractions = listing.investment.availableFractions;
	const referenceLabel =
		listing.referenceLabel ??
		(listing.mlsId ? `MLS #${listing.mlsId}` : undefined);

	const requestedFractions = useMemo(() => {
		const parsed = Number.parseInt(fractionInput, 10);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			return defaultFractions;
		}
		return parsed;
	}, [defaultFractions, fractionInput]);

	const effectiveFractions = Math.min(
		Math.max(minimumFractions, requestedFractions),
		availableFractions
	);
	const calculatedInvestment = effectiveFractions * perFractionAmount;
	let ctaLabel = "";
	if (checkoutSubmitted) {
		ctaLabel = "Lock request queued";
	} else if (checkout) {
		ctaLabel = `Lock ${effectiveFractions} Fractions — Pay ${checkout.lockFee.replace(
			".00",
			""
		)} Fee`;
	}
	const summaryParagraphs = splitSummary(listing.summary);
	const reduceMotion = useReducedMotion();

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
			Math.min(Math.max(minimumFractions, value), availableFractions)
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
		setFractionInput(normalizeFractions(requestedFractions));
	}

	return (
		<div className="flex min-h-0 w-full min-w-0 flex-1 flex-col text-foreground">
			<div className="hidden lg:block">
				<DesktopTopNav listingsIndexTo={listingsIndexTo} mode={mode} />
			</div>
			<div className="lg:hidden">
				<MobileTopNav listingsIndexTo={listingsIndexTo} mode={mode} />
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
						<div className="absolute right-4 bottom-4 rounded-lg bg-black/70 px-3 py-1 font-medium text-sm text-white">
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

					<WhiteSurface className="w-[340px] shrink-0 self-start px-6 py-6">
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
											VALUE_TONE_CLASSES[item.tone ?? "default"]
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
					onDocumentSelect={setSelectedDocumentId}
					selectedDocumentId={selectedDocument?.id}
				/>
				<ListingScrollReveal className="mx-16 mt-10">
					<InvestmentSummaryCard listing={listing} />
				</ListingScrollReveal>

				{isInteractive && checkout ? (
					<ListingScrollReveal className="flex gap-6 px-16 pt-6">
						<WhiteSurface className="flex-1 px-7 py-7">
							<h2 className="font-semibold text-[20px]">
								Select Your Investment
							</h2>
							<div className="mt-5 grid grid-cols-[1fr_auto] items-center gap-4">
								<div className="space-y-2">
									<label
										className="font-medium text-[13px] text-muted-foreground"
										htmlFor="desktop-fractions-input"
									>
										Number of fractions
									</label>
									<Input
										aria-label="Number of fractions"
										className="h-12 rounded-xl border-border/80 bg-background/80 text-base"
										id="desktop-fractions-input"
										onBlur={handleFractionBlur}
										onChange={(event) =>
											handleFractionChange(event.target.value)
										}
										value={fractionInput}
									/>
								</div>
								<div className="rounded-xl border border-primary/20 bg-primary/10 px-5 py-3 font-semibold text-[var(--palm)] text-xl dark:border-primary/30 dark:bg-primary/15">
									= {formatCurrency(calculatedInvestment)}
								</div>
							</div>

							<div className="mt-6 space-y-3">
								<p className="font-medium text-[13px] text-muted-foreground">
									Select your lawyer
								</p>
								{checkout.lawyers.length > 0 ? (
									checkout.lawyers.map((lawyer) => (
										<LawyerOptionCard
											isSelected={lawyer.id === selectedLawyer?.id}
											key={lawyer.id}
											lawyer={lawyer}
											onSelect={setSelectedLawyerId}
										/>
									))
								) : (
									<EmptySelectionState message="No lawyers are configured for this demo listing yet." />
								)}
							</div>
						</WhiteSurface>

						<CheckoutCard
							calculatedInvestment={calculatedInvestment}
							checkout={checkout}
							ctaLabel={ctaLabel}
							fractions={effectiveFractions}
							listingTitle={listing.title}
							onCheckout={handleLockFeeCheckout}
							selectedLawyerLabel={selectedLawyer?.label}
						/>
					</ListingScrollReveal>
				) : (
					<ReadOnlyMarketplaceNotice
						availableFractions={listing.investment.availableFractions}
						className="mx-16 mt-6"
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
					<div className="absolute right-4 bottom-4 rounded-lg bg-black/70 px-3 py-1 font-medium text-sm text-white">
						{selectedImage ? normalizedImageIndex + 1 : 0} /{" "}
						{listing.heroImages.length}
					</div>
				</motion.section>

				<section className="px-5 pt-5">
					<div className="flex flex-wrap gap-1.5">
						{listing.badges.map((badge) => (
							<BadgePill badge={badge} key={badge.id} mobile />
						))}
					</div>
					<h1 className="mt-3 font-semibold text-[24px] leading-[1.08] tracking-[-0.03em]">
						{listing.title}
					</h1>
					<p className="mt-2 text-muted-foreground text-sm">
						{listing.listedLabel}
						{referenceLabel ? ` · ${referenceLabel}` : ""}
					</p>
				</section>

				<section className="px-5 pt-4">
					<button
						className={cn(
							"flex w-full items-center justify-center gap-2 px-4 py-3 font-medium text-[15px]",
							LISTING_ISLAND_CLASS
						)}
						onClick={() => setShowMobileMap((current) => !current)}
						type="button"
					>
						<MapPinned className="size-4" />
						{showMobileMap ? "Hide Map" : "Show Map"} —{" "}
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
					<p className="mt-3 max-w-prose text-[15px] text-foreground/90 leading-[1.65] dark:text-foreground/85">
						{listing.summary}
					</p>
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
									<p className="mt-2 text-muted-foreground text-sm">
										{listing.appraisal.asIs.note}
									</p>
								</div>
								<span className="font-medium text-muted-foreground text-xs uppercase tracking-[0.22em]">
									Full Interior
								</span>
							</div>
							<div className="mt-5 grid grid-cols-2 gap-4">
								<div>
									<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
										Appraised value
									</p>
									<p className="mt-2 font-semibold text-[40px] leading-none tracking-[-0.04em]">
										{listing.appraisal.asIs.value}
									</p>
								</div>
								<div className="space-y-4 pt-1 text-sm">
									<div>
										<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
											Date
										</p>
										<p className="mt-1">{listing.appraisal.asIs.date}</p>
									</div>
									<div>
										<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
											Company
										</p>
										<p className="mt-1">
											{listing.appraisal.asIs.secondaryValue}
										</p>
									</div>
								</div>
							</div>
						</WhiteSurface>

						<WhiteSurface className="border-dashed px-5 py-5">
							<div className="flex items-center gap-2">
								<h2 className="font-semibold text-[22px] leading-none">
									{listing.appraisal.asIf.label}
								</h2>
								<span className="font-semibold text-[10px] text-amber-800 uppercase tracking-[0.24em] dark:text-amber-400">
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
					</div>
				</ListingScrollReveal>

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
							<div className="space-y-2">
								{listing.documents.map((document) => {
									const isSelected = document.id === selectedDocument?.id;
									return (
										<button
											aria-pressed={isSelected}
											className={cn(
												"flex w-full items-center justify-between rounded-xl border px-4 py-4 text-left transition-colors",
												isSelected
													? "border-primary/40 bg-primary/10 dark:border-primary/50 dark:bg-primary/15"
													: "border-border/80 bg-background/50 hover:bg-muted/40"
											)}
											key={document.id}
											onClick={() => setSelectedDocumentId(document.id)}
											type="button"
										>
											<div className="flex items-center gap-3">
												<FileText
													className={cn(
														"size-4",
														isSelected
															? "text-[var(--palm)]"
															: "text-muted-foreground"
													)}
												/>
												<div>
													<span className="block font-medium text-sm">
														{document.label}
													</span>
													<span className="text-[12px] text-muted-foreground">
														{document.meta}
													</span>
												</div>
											</div>
											<ChevronRight
												className={cn(
													"size-4",
													isSelected
														? "text-[var(--palm)]"
														: "text-muted-foreground/70"
												)}
											/>
										</button>
									);
								})}
							</div>

							<WhiteSurface className="px-4 py-4">
								{selectedDocument ? (
									<div className="space-y-4">
										<div className="flex items-start justify-between gap-4">
											<div>
												<p className="font-semibold text-[18px] leading-tight">
													{selectedDocument.label}
												</p>
												<p className="mt-1 text-muted-foreground text-sm">
													{selectedDocument.meta}
												</p>
											</div>
											<span className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 font-medium text-[12px] text-[var(--palm)] dark:border-primary/25 dark:bg-primary/15">
												Selected
											</span>
										</div>

										<div className="flex h-[170px] items-center justify-center rounded-xl border border-border/70 border-dashed bg-muted/25">
											<div className="text-center">
												<FileText className="mx-auto size-8 text-muted-foreground" />
												<p className="mt-3 font-medium text-muted-foreground text-sm">
													{selectedDocument.pageLabel}
												</p>
												<p className="mt-1 text-muted-foreground text-xs">
													Preview details update as you switch documents.
												</p>
											</div>
										</div>
									</div>
								) : (
									<div className="space-y-2 text-muted-foreground text-sm">
										<p>No documents are attached to this demo listing yet.</p>
										<p>Tap a document above to preview it here.</p>
									</div>
								)}
							</WhiteSurface>
						</div>
					) : (
						<WhiteSurface className="mt-3 border-dashed px-4 py-5 text-muted-foreground text-sm">
							No documents are attached to this demo listing yet.
						</WhiteSurface>
					)}
				</ListingScrollReveal>

				<InvestmentSummaryCard className="mx-5 mt-6" listing={listing} mobile />

				{isInteractive && checkout ? (
					<>
						<section className="px-5 pt-3">
							<div className="space-y-4">
								<div className="space-y-2">
									<label
										className="font-medium text-[13px] text-muted-foreground"
										htmlFor="mobile-fractions-input"
									>
										Number of fractions
									</label>
									<div className="grid grid-cols-[1fr_auto] gap-2">
										<Input
											aria-label="Number of fractions"
											className="h-11 rounded-xl border-border/80 bg-background/80"
											id="mobile-fractions-input"
											onBlur={handleFractionBlur}
											onChange={(event) =>
												handleFractionChange(event.target.value)
											}
											value={fractionInput}
										/>
										<div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 font-semibold text-[var(--palm)] text-lg dark:border-primary/30 dark:bg-primary/15">
											= {formatCurrency(calculatedInvestment)}
										</div>
									</div>
								</div>

								<div className="space-y-2">
									<p className="font-medium text-[13px] text-muted-foreground">
										Select your lawyer
									</p>
									{checkout.lawyers.length > 0 ? (
										checkout.lawyers.map((lawyer) => (
											<LawyerOptionCard
												isCompact
												isSelected={lawyer.id === selectedLawyer?.id}
												key={lawyer.id}
												lawyer={lawyer}
												onSelect={setSelectedLawyerId}
											/>
										))
									) : (
										<EmptySelectionState message="No lawyers are configured for this demo listing yet." />
									)}
								</div>
							</div>
						</section>

						<div className="px-5 pt-4">
							<CheckoutCard
								calculatedInvestment={calculatedInvestment}
								checkout={checkout}
								className="w-full px-5 py-5"
								ctaLabel={ctaLabel}
								fractions={effectiveFractions}
								listingTitle={listing.title}
								onCheckout={handleLockFeeCheckout}
								selectedLawyerLabel={selectedLawyer?.label}
							/>
						</div>
					</>
				) : (
					<ReadOnlyMarketplaceNotice
						availableFractions={listing.investment.availableFractions}
						className="mx-5 mt-4"
						totalFractions={listing.investment.totalFractions}
					/>
				)}

				<SimilarListingsSection
					buildHref={buildSimilarListingHref}
					cards={listing.similarListings}
					className="px-5 pt-6"
					mobile
					title="You May Also Like"
				/>
			</div>
		</div>
	);
}

function DesktopTopNav({
	listingsIndexTo,
	mode,
}: {
	listingsIndexTo: ListingsIndexTo;
	mode: ListingDetailPageMode;
}) {
	return (
		<header
			className={cn(
				"flex items-center justify-between border-b px-16 py-4",
				LISTING_HEADER_CLASS
			)}
		>
			<Link
				className="inline-flex items-center gap-2 font-medium text-[13px] text-muted-foreground hover:text-foreground"
				to={listingsIndexTo}
				viewTransition
			>
				<ArrowLeft className="size-4" />
				Back to Listings
			</Link>

			<div className="flex items-center gap-3">
				<div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-2 text-[12px] text-[var(--palm)] dark:border-primary/25 dark:bg-primary/15">
					<span className="size-1.5 rounded-full bg-[var(--lagoon)]" />
					{mode === "readOnly" ? "Read-only marketplace" : "12 viewing now"}
				</div>
				{mode === "interactive" ? (
					<button
						className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/60 px-4 py-2 font-medium text-[13px] hover:bg-muted/40"
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
	listingsIndexTo,
	mode,
}: {
	listingsIndexTo: ListingsIndexTo;
	mode: ListingDetailPageMode;
}) {
	return (
		<header
			className={cn(
				"flex items-center justify-between border-b px-5 py-3",
				LISTING_HEADER_CLASS
			)}
		>
			<Link
				aria-label="Back to Listings"
				className="inline-flex"
				to={listingsIndexTo}
				viewTransition
			>
				<ChevronLeft className="size-5 text-muted-foreground" />
			</Link>
			<div className="flex items-center gap-3 text-[12px]">
				<div className="inline-flex items-center gap-1 text-[var(--palm)]">
					<span className="size-1.5 rounded-full bg-[var(--lagoon)]" />
					{mode === "readOnly" ? "View" : "12"}
				</div>
				{mode === "interactive" ? (
					<button type="button">
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

function DesktopAppraisal({ listing }: { listing: ListingDetailData }) {
	return (
		<ListingScrollReveal className="px-16 pt-10">
			<SectionLabel>Appraisal</SectionLabel>
			<div className="mt-5 grid grid-cols-[minmax(0,1fr)_320px] gap-6">
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
							label="Company"
							value={listing.appraisal.asIs.secondaryValue ?? ""}
						/>
						<InfoColumn label="Type" value={listing.appraisal.asIs.note} />
					</div>
				</WhiteSurface>

				<WhiteSurface className="border-dashed px-6 py-6">
					<div className="flex items-center gap-2">
						<h2 className="font-semibold text-[24px]">
							{listing.appraisal.asIf.label}
						</h2>
						<span className="font-semibold text-[10px] text-amber-800 uppercase tracking-[0.24em] dark:text-amber-400">
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
			</div>
		</ListingScrollReveal>
	);
}

function DesktopComparables({ listing }: { listing: ListingDetailData }) {
	return (
		<ListingScrollReveal className="px-16 pt-4">
			<div className="grid grid-cols-2 gap-6">
				<ComparableTable
					rows={listing.comparables.asIs}
					title="As-Is Comparables"
				/>
				<ComparableTable
					projected
					rows={listing.comparables.asIf}
					title="As-If Comparables"
				/>
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
									<LegendChip color="bg-[#22C55E]" label="On-time" />
									<LegendChip color="bg-[#F59E0B]" label="Late (1-30 days)" />
									<LegendChip color="bg-[#EF4444]" label="Missed (30+ days)" />
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
	documents,
	selectedDocumentId,
	onDocumentSelect,
}: {
	documents: ListingDocumentItem[];
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
				className={cn("mt-5 flex overflow-hidden p-0", LISTING_ISLAND_CLASS)}
			>
				<div className="w-[260px] border-border/70 border-r bg-muted/15 p-3">
					<div className="space-y-1">
						{documents.map((document) => {
							const isSelected = document.id === selectedDocument?.id;
							return (
								<button
									className={cn(
										"flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
										isSelected
											? "bg-primary/12 text-[var(--palm)] dark:bg-primary/18"
											: "text-foreground/90 hover:bg-muted/50"
									)}
									key={document.id}
									onClick={() => onDocumentSelect(document.id)}
									type="button"
								>
									<FileText className="size-4 shrink-0" />
									<div>
										<p className="font-medium text-sm">{document.label}</p>
										<p className="text-[12px] text-muted-foreground">
											{document.meta}
										</p>
									</div>
								</button>
							);
						})}
					</div>
				</div>
				<div className="flex h-[358px] flex-1 flex-col items-center justify-center bg-muted/25 text-center">
					<FileText className="size-10 text-muted-foreground" />
					{selectedDocument ? (
						<>
							<p className="mt-4 font-medium text-muted-foreground text-sm">
								{selectedDocument.pageLabel}
							</p>
							{selectedDocument.url ? (
								<a
									className="mt-3 inline-flex items-center rounded-full border border-border/80 bg-background/70 px-4 py-2 font-medium text-[var(--palm)] text-sm backdrop-blur-sm hover:bg-muted/40"
									href={selectedDocument.url}
									rel="noreferrer"
									target="_blank"
								>
									Open document
								</a>
							) : (
								<p className="mt-2 text-muted-foreground text-sm">
									Inline PDF viewer renders here
								</p>
							)}
						</>
					) : (
						<p className="mt-4 text-muted-foreground text-sm">
							No documents are attached to this demo listing yet.
						</p>
					)}
				</div>
			</div>
		</ListingScrollReveal>
	);
}

function InvestmentSummaryCard({
	className,
	listing,
	mobile = false,
}: {
	className?: string;
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

	return (
		<section className={className}>
			<SectionLabel>Invest in This Mortgage</SectionLabel>
			<WhiteSurface
				className={cn("mt-5 px-6 py-6", mobile && "mt-3 px-5 py-5")}
			>
				<div className="flex items-center justify-between gap-4 text-muted-foreground text-sm">
					<span>Fraction Availability</span>
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
						label="Minimum purchase"
						value={`${minimumFractions} frac.`}
					/>
					<MiniMetric
						label="Yield"
						tone="positive"
						value={listing.investment.projectedYield}
					/>
				</div>
				<p className="mt-5 text-muted-foreground text-sm">
					{listing.investment.investorCountLabel}
				</p>
				<p className="mt-2 text-[12px] text-muted-foreground/90">
					Maximum available for this listing:{" "}
					{listing.investment.availableFractions.toLocaleString()} fractions
				</p>
			</WhiteSurface>
		</section>
	);
}

function CheckoutCard({
	calculatedInvestment,
	checkout,
	className,
	ctaLabel,
	fractions,
	listingTitle,
	onCheckout,
	selectedLawyerLabel,
}: {
	calculatedInvestment: number;
	checkout: NonNullable<ListingDetailData["checkout"]>;
	className?: string;
	ctaLabel: string;
	fractions: number;
	listingTitle: string;
	onCheckout: () => void;
	selectedLawyerLabel?: string;
}) {
	const idBase = useId();
	const cardNumberId = `${idBase}-card-number`;
	const expiryId = `${idBase}-expiry`;
	const cvcId = `${idBase}-cvc`;

	return (
		<div
			className={cn(
				"w-[400px] shrink-0 rounded-xl bg-[#1B4332] px-7 py-7 text-white",
				className
			)}
		>
			<h2 className="font-semibold text-[20px]">Lock Fee Checkout</h2>
			<div className="mt-5 space-y-3 text-sm">
				<CheckoutRow label="Listing" value={listingTitle} />
				<CheckoutRow
					label="Fractions"
					value={`${fractions} (${formatCurrency(calculatedInvestment)})`}
				/>
				<CheckoutRow
					label="Lawyer"
					value={selectedLawyerLabel ?? "No lawyer selected"}
				/>
				<CheckoutRow emphasis label="Lock Fee" value={checkout.lockFee} />
			</div>

			<div className="mt-6 space-y-3">
				<div>
					<label className="text-[12px] text-white/70" htmlFor={cardNumberId}>
						Card number
					</label>
					<Input
						className="mt-1 h-11 border-white/15 bg-white/6 text-white placeholder:text-white/45"
						defaultValue="4242 4242 4242 4242"
						id={cardNumberId}
					/>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div>
						<label className="text-[12px] text-white/70" htmlFor={expiryId}>
							Expiry
						</label>
						<Input
							className="mt-1 h-11 border-white/15 bg-white/6 text-white placeholder:text-white/45"
							defaultValue="MM / YY"
							id={expiryId}
						/>
					</div>
					<div>
						<label className="text-[12px] text-white/70" htmlFor={cvcId}>
							CVC
						</label>
						<Input
							className="mt-1 h-11 border-white/15 bg-white/6 text-white placeholder:text-white/45"
							defaultValue="123"
							id={cvcId}
						/>
					</div>
				</div>
			</div>

			<Button className="mt-6 h-11 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
				{ctaLabel}
			</Button>

			<p className="mt-4 text-[12px] text-white/65 leading-5">
				Non-refundable lock fee. Powered by {checkout.poweredBy}. Secures your
				fractions while the deal is documented.
			</p>
		</div>
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
							LISTING_ISLAND_CLASS,
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
		<div className="w-[min(280px,calc(100vw-3rem))] rounded-lg border border-border bg-card p-3 text-card-foreground shadow-lg">
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
				className={cn(
					"flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-6 text-center text-muted-foreground dark:bg-muted/25",
					className
				)}
				id={mapPanelId}
			>
				<div className="relative flex size-[180px] items-center justify-center rounded-full border border-primary/25 border-dashed bg-background/50 dark:border-primary/35 dark:bg-background/30">
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
				"flex h-full w-full items-center justify-center rounded-xl",
				image ? HERO_TONE_CLASSES[image.tone] : HERO_TONE_CLASSES.stone,
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
				LISTING_ISLAND_CLASS
			)}
		>
			{message}
		</div>
	);
}

function ReadOnlyMarketplaceNotice({
	availableFractions,
	className,
	totalFractions,
}: {
	availableFractions: number;
	className?: string;
	totalFractions: number;
}) {
	return (
		<section className={className}>
			<WhiteSurface className="px-6 py-6">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
					<div className="space-y-2">
						<SectionLabel>Read-only release</SectionLabel>
						<h2 className="font-semibold text-[22px] leading-tight">
							Fraction locking opens in the next phase
						</h2>
						<p className="max-w-2xl text-muted-foreground text-sm leading-6">
							Availability on this page is live and accurate. Lawyer selection,
							fraction reservation, and lock-fee checkout stay disabled on the
							production marketplace until transaction workflows are promoted.
						</p>
					</div>
					<div className="rounded-2xl border border-primary/15 bg-primary/10 px-5 py-4 text-right dark:border-primary/25 dark:bg-primary/15">
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
	return <div className={cn(LISTING_ISLAND_CLASS, className)}>{children}</div>;
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
					VALUE_TONE_CLASSES[item.tone ?? "default"]
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
		<WhiteSurface className="px-4 py-4">
			<p className="text-[12px] text-muted-foreground">{item.label}</p>
			<p
				className={cn(
					"mt-2 font-semibold text-[32px] leading-none tracking-[-0.04em]",
					VALUE_TONE_CLASSES[item.tone ?? "default"]
				)}
			>
				{item.value}
			</p>
		</WhiteSurface>
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
					<span className="font-semibold text-[10px] text-amber-800 uppercase tracking-[0.24em] dark:text-amber-400">
						Projected
					</span>
				) : null}
			</div>
			<div className="mt-4 overflow-hidden rounded-lg border border-border/70">
				<div className="grid grid-cols-[1.6fr_1fr_0.9fr_0.8fr_0.8fr] gap-3 bg-muted/40 px-4 py-3 text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
					<span>Address</span>
					<span>Price</span>
					<span>Date</span>
					<span>Dist.</span>
					<span>Sq Ft</span>
				</div>
				{rows.length > 0 ? (
					rows.map((row) => (
						<div
							className="grid grid-cols-[1.6fr_1fr_0.9fr_0.8fr_0.8fr] gap-3 border-border/60 border-t px-4 py-3 text-sm"
							key={row.id}
						>
							<span>{row.address}</span>
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

function SignalRow({ item }: { item: ListingBorrowerSignal }) {
	return (
		<div className="flex items-center justify-between gap-4">
			<span className="text-[15px] text-foreground/90">{item.label}</span>
			<span
				className={cn(
					"inline-flex items-center rounded-full font-medium text-sm",
					item.value === "Approved"
						? "bg-[var(--palm)] px-3 py-1 text-white"
						: VALUE_TONE_CLASSES[item.tone]
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
	return (
		<button
			aria-pressed={isSelected}
			className={cn(
				"flex w-full items-start gap-3 rounded-xl border px-4 py-4 text-left transition-colors",
				isSelected
					? "border-primary/45 bg-primary/10 dark:border-primary/55 dark:bg-primary/15"
					: "border-border/80 bg-background/40 hover:bg-muted/45 dark:bg-background/25",
				isCompact && "px-4 py-3"
			)}
			onClick={() => onSelect(lawyer.id)}
			type="button"
		>
			<div
				className={cn(
					"mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
					isSelected
						? "border-[var(--palm)] bg-[var(--palm)] text-white"
						: "border-muted-foreground/35 bg-card text-transparent"
				)}
			>
				<Check className="size-3" />
			</div>
			<div>
				<p className="font-medium text-sm">{lawyer.label}</p>
				<p className="mt-1 text-[13px] text-muted-foreground">
					{lawyer.detail}
				</p>
			</div>
		</button>
	);
}

function SectionLabel({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<p
			className={cn(
				"font-semibold text-[12px] text-muted-foreground uppercase tracking-[0.22em]",
				className
			)}
		>
			{children}
		</p>
	);
}

function BadgePill({
	badge,
	mobile = false,
}: {
	badge: ListingBadge;
	mobile?: boolean;
}) {
	if (badge.tone === "dark") {
		return (
			<Badge
				className={cn("bg-[var(--palm)] text-white", mobile && "text-[10px]")}
			>
				{badge.label}
			</Badge>
		);
	}

	return (
		<Badge
			className={cn(
				"border-border/80 bg-card/90 text-foreground/90 backdrop-blur-sm",
				mobile && "text-[10px]"
			)}
			variant="outline"
		>
			{badge.label}
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
			className={cn(
				"absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-card/90 text-foreground shadow-md backdrop-blur-md disabled:cursor-not-allowed disabled:opacity-50",
				className
			)}
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

function MiniMetric({
	label,
	tone = "default",
	value,
}: {
	label: string;
	tone?: ListingValueTone;
	value: string;
}) {
	return (
		<div>
			<p className="text-muted-foreground text-sm">{label}</p>
			<p
				className={cn(
					"mt-1 font-semibold text-[30px] leading-none tracking-[-0.04em]",
					VALUE_TONE_CLASSES[tone]
				)}
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

function CheckoutRow({
	emphasis = false,
	label,
	value,
}: {
	emphasis?: boolean;
	label: string;
	value: string;
}) {
	return (
		<div className="flex items-start justify-between gap-4">
			<span className="text-white/70">{label}</span>
			<span
				className={cn(
					"text-right",
					emphasis ? "font-semibold text-[32px] leading-none" : "font-medium"
				)}
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
			return "bg-[#F59E0B] text-white";
		case "missed":
			return "bg-[#EF4444] text-white";
		case "onTime":
			return "bg-[#22C55E] text-white";
		default:
			return "bg-muted text-foreground";
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

function formatCurrency(amount: number) {
	return new Intl.NumberFormat("en-CA", {
		style: "currency",
		currency: "CAD",
		maximumFractionDigits: 0,
	}).format(amount);
}

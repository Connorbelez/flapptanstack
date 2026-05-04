import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { getListingDetailMock } from "#/components/demo/listings/listing-detail-mock-data";
import { ListingDetailPage } from "#/components/listings/ListingDetailPage";
import type {
	ListingDetailData,
	ListingDocumentItem,
} from "#/components/listings/listing-detail-types";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const testDocumentStorageIds = [
	"kg20r04rzbtawec6vjbjpfd92585fpyt",
	"kg2b1k3egsafmkn1w3tty8qb2d85f65r",
] as const satisfies readonly string[];
const e2eListingId = "e2e-public-pdf-listing";
const e2eListingTitle = "E2E Public PDF Listing";

export const Route = createFileRoute("/e2e/marketplace-public-documents")({
	ssr: false,
	component: MarketplacePublicDocumentsE2eRoute,
});

function buildDocuments(
	urlRows: Array<{ storageId: Id<"_storage">; url: string | null }> | undefined
): ListingDocumentItem[] {
	return testDocumentStorageIds.map((storageId, index) => {
		const displayIndex = index + 1;
		const url =
			urlRows?.find((row) => String(row.storageId) === storageId)?.url ?? null;

		return {
			assetId: storageId,
			contentType: "application/pdf",
			description: `E2E public listing document backed by storage id ${storageId}.`,
			fileName: `e2e-public-pdf-${displayIndex}.pdf`,
			id: `e2e-public-pdf-${displayIndex}`,
			kind: "pdf",
			label: `E2E Public PDF ${displayIndex}`,
			meta: `Public PDF • ${storageId}`,
			url,
		};
	});
}

function buildListing(documents: ListingDocumentItem[]): ListingDetailData {
	const baseListing = getListingDetailMock("first-mortgage-condo-scarborough");
	if (!baseListing) {
		throw new Error(
			"Missing base listing fixture for marketplace PDF e2e route"
		);
	}

	return {
		...baseListing,
		id: e2eListingId,
		title: e2eListingTitle,
		documents,
		listedLabel: "Listed for marketplace PDF e2e",
		summary:
			"E2E fixture that exercises marketplace public PDF rendering with real Convex storage documents.",
	};
}

function ListingCard({ onOpen }: { onOpen: () => void }) {
	return (
		<div className="mx-auto max-w-3xl px-6 py-12">
			<h1 className="font-semibold text-3xl tracking-tight">
				Marketplace public document fixtures
			</h1>
			<button
				className="mt-8 block w-full rounded-xl border border-[#E7E5E4] bg-white px-5 py-5 text-left shadow-sm transition hover:bg-[#FBFAF8]"
				onClick={onOpen}
				type="button"
			>
				<p className="font-semibold text-xl">{e2eListingTitle}</p>
				<p className="mt-2 text-[#6B6B68] text-sm">
					Open the listing detail page with two public PDF documents.
				</p>
			</button>
		</div>
	);
}

function MarketplacePublicDocumentsE2eRoute() {
	const [isDetailOpen, setIsDetailOpen] = useState(false);
	const urls = useQuery(api.admin.origination.media.getStorageUrls, {
		storageIds: testDocumentStorageIds as unknown as Id<"_storage">[],
	});
	const documents = useMemo(() => buildDocuments(urls), [urls]);
	const listing = useMemo(() => buildListing(documents), [documents]);

	if (!import.meta.env.VITE_E2E) {
		return (
			<main className="px-6 py-12">
				<p>Marketplace public document e2e route is disabled.</p>
			</main>
		);
	}

	if (urls === undefined) {
		return (
			<main className="px-6 py-12">
				<p>Loading marketplace public document fixtures...</p>
			</main>
		);
	}

	if (!isDetailOpen) {
		return <ListingCard onOpen={() => setIsDetailOpen(true)} />;
	}

	return (
		<ListingDetailPage
			backHref="/e2e/marketplace-public-documents"
			listing={listing}
			mode="readOnly"
		/>
	);
}

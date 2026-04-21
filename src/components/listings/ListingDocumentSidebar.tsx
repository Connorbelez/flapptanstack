import { ChevronRight, File, FileText } from "lucide-react";
import { cn } from "#/lib/utils";
import type { ListingDocumentItem } from "./listing-detail-types";

interface ListingDocumentSidebarProps {
	documents: ListingDocumentItem[];
	mobile?: boolean;
	onSelect: (documentId: string) => void;
	selectedDocumentId?: string;
}

function ListingDocumentIcon({
	document,
	isSelected,
}: {
	document: ListingDocumentItem;
	isSelected: boolean;
}) {
	const Icon = document.kind === "pdf" ? FileText : File;

	return (
		<Icon
			className={cn(
				"size-4 shrink-0",
				isSelected ? "text-[#204636]" : "text-[#737373]"
			)}
		/>
	);
}

export function ListingDocumentSidebar({
	documents,
	mobile = false,
	onSelect,
	selectedDocumentId,
}: ListingDocumentSidebarProps) {
	if (documents.length === 0) {
		return null;
	}

	return (
		<div className={mobile ? "space-y-2" : "space-y-1"}>
			{documents.map((document) => {
				const isSelected = document.id === selectedDocumentId;

				return (
					<button
						aria-pressed={isSelected}
						className={cn(
							"w-full rounded-xl text-left transition-colors",
							mobile
								? cn(
										"flex items-center justify-between border px-4 py-4",
										isSelected
											? "border-[#204636] bg-[#F1FAF3]"
											: "border-[#E7E5E4] bg-white"
									)
								: cn(
										"flex items-center gap-3 px-3 py-3",
										isSelected
											? "bg-[#F1FAF3] text-[#204636]"
											: "text-[#4A4A48] hover:bg-[#F7F6F3]"
									)
						)}
						key={document.id}
						onClick={() => onSelect(document.id)}
						type="button"
					>
						<div className="flex min-w-0 items-center gap-3">
							<ListingDocumentIcon
								document={document}
								isSelected={isSelected}
							/>
							<div className="min-w-0">
								<p className="truncate font-medium text-sm">{document.label}</p>
								<p className="truncate text-[#888784] text-[12px]">
									{document.meta}
								</p>
							</div>
						</div>
						{mobile ? (
							<ChevronRight
								className={cn(
									"size-4 shrink-0",
									isSelected ? "text-[#204636]" : "text-[#A3A3A3]"
								)}
							/>
						) : null}
					</button>
				);
			})}
		</div>
	);
}

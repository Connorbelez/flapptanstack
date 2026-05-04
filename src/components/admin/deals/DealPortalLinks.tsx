"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import type { Id } from "../../../../convex/_generated/dataModel";

const DEAL_PORTAL_LINKS = [
	{ label: "Broker portal", segment: "broker" },
	{ label: "Lender portal", segment: "lender" },
	{ label: "Borrower portal", segment: "borrower" },
	{ label: "Lawyer portal", segment: "lawyer" },
] as const;

export function DealPortalLinks({ dealId }: { readonly dealId: Id<"deals"> }) {
	return (
		<div className="flex justify-end">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button size="sm" type="button" variant="outline">
						<ExternalLink className="size-4" />
						Open portal
						<ChevronDown className="size-4 text-muted-foreground" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-44">
					{DEAL_PORTAL_LINKS.map((link) => (
						<DropdownMenuItem asChild key={link.segment}>
							<a href={`/${link.segment}/deals/${dealId}`}>{link.label}</a>
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

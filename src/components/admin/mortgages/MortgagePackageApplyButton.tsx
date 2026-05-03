"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminDescriptionHelp } from "#/components/admin/AdminDescriptionHelp";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface MortgagePackageApplyButtonProps {
	readonly disabled?: boolean;
	readonly mortgageId: Id<"mortgages">;
}

export function MortgagePackageApplyButton({
	disabled,
	mortgageId,
}: MortgagePackageApplyButtonProps) {
	const packageVersions = useQuery(api.documentEngine.packages.listAllVersions);
	const applyPackage = useMutation(
		api.documents.mortgagePackages.applyPackageVersion
	);
	const [open, setOpen] = useState(false);
	const [packageVersionId, setPackageVersionId] = useState<
		Id<"documentPackageVersions"> | ""
	>("");

	async function handleApply() {
		if (!packageVersionId) {
			return;
		}
		try {
			await applyPackage({ mortgageId, packageVersionId });
			toast.success("Package applied for future deal locks");
			setOpen(false);
			setPackageVersionId("");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Unable to apply package"
			);
		}
	}

	return (
		<>
			<Button
				disabled={disabled}
				onClick={() => setOpen(true)}
				size="sm"
				type="button"
				variant="outline"
			>
				Apply package
			</Button>
			<Dialog onOpenChange={setOpen} open={open}>
				<DialogContent>
					<DialogHeader>
						<div className="flex items-center gap-1.5">
							<DialogTitle>Apply Document Package</DialogTitle>
							<AdminDescriptionHelp
								content="Applies only to future deal locks. Existing locked deal documents keep their immutable snapshots."
								label="Apply Document Package details"
							/>
						</div>
						<DialogDescription className="sr-only">
							Applies only to future deal locks. Existing locked deal documents
							keep their immutable snapshots.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<Select
							onValueChange={(value) =>
								setPackageVersionId(value as Id<"documentPackageVersions">)
							}
							value={packageVersionId}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select published package" />
							</SelectTrigger>
							<SelectContent>
								{packageVersions?.map((version) => (
									<SelectItem key={version._id} value={version._id}>
										{version.packageName} v{version.version}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							className="w-full"
							disabled={!packageVersionId}
							onClick={() => void handleApply()}
						>
							Apply for Future Deal Locks
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}

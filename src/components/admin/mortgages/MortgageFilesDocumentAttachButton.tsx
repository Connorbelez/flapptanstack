"use client";

import { useState } from "react";
import { Button } from "#/components/ui/button";
import { MortgageDocumentAttachComposer } from "./MortgageDocumentAttachComposer";

interface MortgageFilesDocumentAttachButtonProps {
	readonly mortgageId: string;
}

export function MortgageFilesDocumentAttachButton({
	mortgageId,
}: MortgageFilesDocumentAttachButtonProps) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Button onClick={() => setOpen(true)} size="sm" type="button">
				Attach document
			</Button>
			<MortgageDocumentAttachComposer
				mortgageId={mortgageId}
				onOpenChange={setOpen}
				open={open}
			/>
		</>
	);
}

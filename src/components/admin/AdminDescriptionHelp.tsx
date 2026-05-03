"use client";

import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import { cn } from "#/lib/utils";

export function AdminDescriptionHelp({
	className,
	content,
	label = "More information",
}: {
	readonly className?: string;
	readonly content: ReactNode;
	readonly label?: string;
}) {
	if (!content) {
		return null;
	}

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						aria-label={label}
						className={cn(
							"inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
							className
						)}
						type="button"
					>
						<CircleHelp aria-hidden="true" className="size-3.5" />
					</button>
				</TooltipTrigger>
				<TooltipContent
					className="max-w-72 text-pretty leading-5"
					side="top"
					sideOffset={6}
				>
					{content}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

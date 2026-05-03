import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "#/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import { cn } from "#/lib/utils";

interface PortfolioShellProps {
	cockpitSlot: ReactNode;
	exportStripSlot: ReactNode;
	paymentActivitySection: ReactNode;
	positionsSection: ReactNode;
	stickyRailSlot: ReactNode;
	suggestedOpportunitiesSlot: ReactNode;
}

interface PortfolioSlotHostProps {
	children?: ReactNode;
	className?: string;
	dataTestId?: string;
	description: string;
	eyebrow?: string;
	summary?: string;
	title: string;
}

export function PortfolioShell({
	cockpitSlot,
	exportStripSlot,
	paymentActivitySection,
	positionsSection,
	stickyRailSlot,
	suggestedOpportunitiesSlot,
}: PortfolioShellProps) {
	return (
		<div
			className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8"
			data-testid="lender-portfolio-shell"
		>
			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
				<div className="space-y-6">
					{cockpitSlot}
					<div className="xl:hidden">{stickyRailSlot}</div>
					{positionsSection}
					{paymentActivitySection}
					{exportStripSlot}
					{suggestedOpportunitiesSlot}
				</div>
				<aside className="hidden xl:block">
					<div className="sticky top-24">{stickyRailSlot}</div>
				</aside>
			</div>
		</div>
	);
}

export function PortfolioSlotHost({
	children,
	className,
	dataTestId,
	description,
	eyebrow,
	summary,
	title,
}: PortfolioSlotHostProps) {
	return (
		<Card
			className={cn(
				"gap-0 overflow-hidden border-border/70 bg-card/95",
				className
			)}
			data-testid={dataTestId}
		>
			<CardHeader className="gap-4 border-border/70 border-b bg-muted/20 py-5">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
					<div className="space-y-1.5">
						{eyebrow ? (
							<p className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
								{eyebrow}
							</p>
						) : null}
						<div className="flex items-center gap-2">
							<CardTitle className="text-xl">{title}</CardTitle>
							<PortfolioDescriptionTooltip
								label={`About ${title}`}
								text={description}
							/>
						</div>
					</div>
					{summary ? (
						<Badge className="self-start" variant="outline">
							{summary}
						</Badge>
					) : null}
				</div>
			</CardHeader>
			{children ? <CardContent className="pt-5">{children}</CardContent> : null}
		</Card>
	);
}

export function PortfolioDescriptionTooltip({
	label,
	text,
}: {
	label: string;
	text: string;
}) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						aria-label={label}
						className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						type="button"
					>
						<CircleHelp className="size-4" />
					</button>
				</TooltipTrigger>
				<TooltipContent
					className="max-w-72 text-pretty leading-5"
					sideOffset={6}
				>
					{text}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

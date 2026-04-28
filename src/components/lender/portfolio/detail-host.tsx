"use client";

import { XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "#/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "#/components/ui/drawer";
import { ScrollArea } from "#/components/ui/scroll-area";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "#/components/ui/sheet";
import { useIsMobile } from "#/hooks/use-mobile";
import { cn } from "#/lib/utils";

interface PortfolioDetailHostProps {
	children: ReactNode;
	dataTestId: string;
	description: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}

export function PortfolioDetailHost({
	children,
	dataTestId,
	description,
	onOpenChange,
	open,
	title,
}: PortfolioDetailHostProps) {
	const isMobile = useIsMobile();

	if (isMobile) {
		return (
			<Drawer onOpenChange={onOpenChange} open={open}>
				<DrawerContent
					className="h-[92vh] gap-0 rounded-t-2xl border-t bg-background p-0"
					data-testid={dataTestId}
				>
					<div className="flex items-start justify-between gap-4 border-border/70 border-b px-5 py-4">
						<DrawerHeader className="p-0 text-left">
							<DrawerTitle>{title}</DrawerTitle>
							<DrawerDescription>{description}</DrawerDescription>
						</DrawerHeader>
						<Button
							aria-label={`Close ${title}`}
							onClick={() => onOpenChange(false)}
							size="icon-sm"
							variant="ghost"
						>
							<XIcon className="size-4" />
						</Button>
					</div>
					<ScrollArea className="flex-1">{children}</ScrollArea>
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Sheet onOpenChange={onOpenChange} open={open}>
			<SheetContent
				className="w-full gap-0 border-l bg-background p-0 sm:max-w-[72rem]"
				data-testid={dataTestId}
				showCloseButton={false}
				side="right"
			>
				<div className="flex items-start justify-between gap-4 border-border/70 border-b px-6 py-5">
					<SheetHeader className="p-0">
						<SheetTitle className="text-left text-xl">{title}</SheetTitle>
						<SheetDescription className="text-left">
							{description}
						</SheetDescription>
					</SheetHeader>
					<Button
						aria-label={`Close ${title}`}
						onClick={() => onOpenChange(false)}
						size="icon-sm"
						variant="ghost"
					>
						<XIcon className="size-4" />
					</Button>
				</div>
				<ScrollArea className="h-[calc(100vh-6rem)]">{children}</ScrollArea>
			</SheetContent>
		</Sheet>
	);
}

export function PortfolioDetailSection({
	children,
	className,
	description,
	title,
}: {
	children: ReactNode;
	className?: string;
	description?: string;
	title: string;
}) {
	return (
		<section
			className={cn(
				"border-border/70 border-b px-6 py-5 last:border-b-0",
				className
			)}
		>
			<div className="space-y-1">
				<h2 className="font-medium text-base">{title}</h2>
				{description ? (
					<p className="text-muted-foreground text-sm leading-6">
						{description}
					</p>
				) : null}
			</div>
			<div className="mt-4">{children}</div>
		</section>
	);
}

export function PortfolioKeyValueGrid({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<dl className={cn("grid gap-x-6 sm:grid-cols-2", className)}>{children}</dl>
	);
}

export function PortfolioKeyValueRow({
	label,
	value,
}: {
	label: string;
	value: ReactNode;
}) {
	return (
		<div className="space-y-1 border-border/60 border-t py-3">
			<dt className="text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
				{label}
			</dt>
			<dd className="font-medium text-sm">{value}</dd>
		</div>
	);
}

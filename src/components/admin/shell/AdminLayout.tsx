import type { CSSProperties, ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { AdminBreadcrumbs } from "./AdminBreadcrumbs";
import { AppSidebar } from "./AdminNavigation";

export interface AdminLayoutProps {
	children: ReactNode;
}

type AdminShellCssVars = CSSProperties & Record<`--${string}`, string>;

const adminShellStyle: AdminShellCssVars = {
	"--accent": "oklch(0.19 0 0)",
	"--accent-foreground": "oklch(0.98 0 0)",
	"--background": "oklch(0 0 0)",
	"--border": "oklch(0.22 0 0)",
	"--card": "oklch(0 0 0)",
	"--card-foreground": "oklch(0.98 0 0)",
	"--foreground": "oklch(0.98 0 0)",
	"--input": "oklch(0.22 0 0)",
	"--muted": "oklch(0.16 0 0)",
	"--muted-foreground": "oklch(0.72 0 0)",
	"--popover": "oklch(0 0 0)",
	"--popover-foreground": "oklch(0.98 0 0)",
	"--primary": "oklch(0.98 0 0)",
	"--primary-foreground": "oklch(0 0 0)",
	"--ring": "oklch(0.62 0 0)",
	"--secondary": "oklch(0.14 0 0)",
	"--secondary-foreground": "oklch(0.98 0 0)",
	"--sidebar": "oklch(0 0 0)",
	"--sidebar-accent": "oklch(0.16 0 0)",
	"--sidebar-accent-foreground": "oklch(0.98 0 0)",
	"--sidebar-border": "oklch(0.22 0 0)",
	"--sidebar-foreground": "oklch(0.9 0 0)",
	"--sidebar-primary": "oklch(0.98 0 0)",
	"--sidebar-primary-foreground": "oklch(0 0 0)",
	"--sidebar-ring": "oklch(0.62 0 0)",
	"--sidebar-width-icon": "4rem",
};

export function AdminLayout({ children }: AdminLayoutProps) {
	return (
		<SidebarProvider
			className="min-h-full bg-black text-foreground"
			style={adminShellStyle}
		>
			<AppSidebar />
			<SidebarInset className="min-h-full bg-black">
				<div className="flex min-h-full flex-col bg-black">
					<header className="sticky top-0 z-20 border-border border-b bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/85">
						<div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
							<div className="flex min-w-0 items-center gap-2">
								<SidebarTrigger className="-ml-1" />
								<Separator
									className="mr-2 hidden data-[orientation=vertical]:h-4 sm:block"
									orientation="vertical"
								/>
								<div className="min-w-0">
									<AdminBreadcrumbs />
								</div>
							</div>
						</div>
					</header>
					<div className="flex flex-1 flex-col gap-4 bg-black p-4 md:p-6">
						{children}
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Menu, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "#/lib/utils";

export interface NavItem {
	active?: boolean;
	badge?: number | string;
	href: string;
	label: string;
}

export interface CtaAction {
	href?: string;
	label: string;
	onClick?: () => void;
}

export interface SecondaryAction {
	href?: string;
	label: string;
	onClick?: () => void;
}

export interface UserDisplay {
	avatarUrl?: string;
	email?: string;
	initials?: string;
	name: string;
}

export interface FairLendAnimatedHeaderProps {
	/** Brand name rendered as the primary wordmark */
	brandName: string;
	/** Optional additional className for the header element */
	className?: string;
	/** Optional primary CTA button */
	cta?: CtaAction;
	/** Optional small text above or beside the brand name */
	eyebrow?: string;
	/** Navigation items to render */
	navItems: NavItem[];
	/** Callback when mobile menu toggles */
	onMenuToggle?: (isOpen: boolean) => void;
	/** Optional secondary action (text link style) */
	secondaryAction?: SecondaryAction;
	/** Optional user display object */
	user?: UserDisplay;
}

function BrandDot({ className }: { className?: string }) {
	return (
		<span
			className={cn("relative inline-block size-2.5 rounded-full", className)}
		>
			<span className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,var(--lagoon),var(--palm))]" />
			<span className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,var(--lagoon),var(--palm))] opacity-60 motion-safe:animate-ping" />
		</span>
	);
}

function getUserInitials(user: UserDisplay) {
	return (
		user.initials ||
		user.name
			.split(" ")
			.map((namePart) => namePart[0])
			.join("")
			.toUpperCase()
			.slice(0, 2)
	);
}

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
	const isExternal = item.href.startsWith("http");

	return (
		<a
			aria-current={item.active ? "page" : undefined}
			className={cn(
				"group relative inline-flex items-center gap-1.5 px-1 py-2 font-medium text-sm no-underline transition-colors duration-200",
				item.active
					? "text-[var(--sea-ink)]"
					: "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
			)}
			href={item.href}
			onClick={onClick}
			rel={isExternal ? "noreferrer" : undefined}
			target={isExternal ? "_blank" : undefined}
		>
			<span>{item.label}</span>
			{item.badge !== undefined && (
				<span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-[var(--palm)] px-1.5 py-0.5 font-semibold text-[10px] text-white leading-none">
					{item.badge}
				</span>
			)}
			<span
				className={cn(
					"absolute bottom-0 left-0 h-[2px] w-full origin-left rounded-full bg-[linear-gradient(90deg,var(--lagoon),#7ed3bf)] transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]",
					item.active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
				)}
			/>
		</a>
	);
}

function UserChip({ user }: { user: UserDisplay }) {
	const initials = getUserInitials(user);

	return (
		<div
			aria-label={user.email ? `${user.name}, ${user.email}` : user.name}
			className="flex items-center gap-2.5 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2.5 py-1.5 shadow-[0_8px_24px_rgba(30,90,72,0.08)]"
			role="group"
		>
			{user.avatarUrl ? (
				<img
					alt=""
					className="size-7 rounded-full object-cover"
					height={28}
					src={user.avatarUrl}
					width={28}
				/>
			) : (
				<span className="flex size-7 items-center justify-center rounded-full bg-[var(--sand)] font-semibold text-[var(--palm)] text-xs">
					{initials}
				</span>
			)}
			<div className="hidden leading-none sm:block">
				<p className="font-semibold text-[var(--sea-ink)] text-xs">
					{user.name}
				</p>
				{user.email && (
					<p className="mt-0.5 text-[10px] text-[var(--sea-ink-soft)]">
						{user.email}
					</p>
				)}
			</div>
		</div>
	);
}

export function FairLendAnimatedHeader({
	brandName,
	eyebrow,
	navItems,
	cta,
	secondaryAction,
	user,
	onMenuToggle,
	className,
}: FairLendAnimatedHeaderProps) {
	const [mobileOpen, setMobileOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const toggleRef = useRef<HTMLButtonElement>(null);

	const handleToggle = useCallback(() => {
		setMobileOpen((prev) => {
			const next = !prev;
			onMenuToggle?.(next);
			return next;
		});
	}, [onMenuToggle]);

	const handleClose = useCallback(() => {
		setMobileOpen(false);
		onMenuToggle?.(false);
	}, [onMenuToggle]);

	// Close on Escape
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape" && mobileOpen) {
				handleClose();
				toggleRef.current?.focus();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [mobileOpen, handleClose]);

	// Close on click outside
	useEffect(() => {
		function onClick(e: MouseEvent) {
			if (
				mobileOpen &&
				menuRef.current &&
				!menuRef.current.contains(e.target as Node) &&
				!toggleRef.current?.contains(e.target as Node)
			) {
				handleClose();
			}
		}
		window.addEventListener("mousedown", onClick);
		return () => window.removeEventListener("mousedown", onClick);
	}, [mobileOpen, handleClose]);

	// Lock body scroll when mobile menu open
	useEffect(() => {
		if (mobileOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [mobileOpen]);

	return (
		<header
			className={cn(
				"relative z-50 w-full border-[var(--line)] border-b bg-[var(--header-bg)] backdrop-blur-xl",
				className
			)}
		>
			<div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:px-8">
				{/* Brand */}
				<div className="flex items-center gap-3">
					<a
						className="group inline-flex items-center gap-2.5 no-underline"
						href="/"
					>
						<BrandDot className="shrink-0 motion-reduce:animate-none" />
						<div className="flex flex-col">
							{eyebrow && (
								<span className="hidden font-medium text-[10px] text-[var(--sea-ink-soft)] uppercase leading-none tracking-[0.14em] sm:block">
									{eyebrow}
								</span>
							)}
							<span className="font-bold font-serif text-[var(--sea-ink)] text-lg leading-none tracking-tight">
								{brandName}
							</span>
						</div>
					</a>
				</div>

				{/* Desktop Nav */}
				<nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
					{navItems.map((item) => (
						<NavLink item={item} key={item.href + item.label} />
					))}
				</nav>

				{/* Desktop Actions */}
				<div className="hidden items-center gap-3 md:flex">
					{secondaryAction && (
						<a
							className="font-medium text-[var(--sea-ink-soft)] text-sm no-underline transition-colors duration-200 hover:text-[var(--sea-ink)]"
							href={secondaryAction.href || "#"}
							onClick={(e) => {
								if (secondaryAction.onClick) {
									e.preventDefault();
									secondaryAction.onClick();
								}
							}}
						>
							{secondaryAction.label}
						</a>
					)}
					{cta && (
						<a
							className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--palm)] px-4 py-2 font-semibold text-sm text-white no-underline shadow-[0_4px_14px_rgba(47,106,74,0.28)] transition-all duration-200 hover:-translate-y-px hover:bg-[#27633f] hover:shadow-[0_6px_20px_rgba(47,106,74,0.36)] focus-visible:ring-2 focus-visible:ring-[var(--lagoon)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--header-bg)] active:translate-y-0 active:scale-[0.98] motion-reduce:hover:translate-y-0"
							href={cta.href || "#"}
							onClick={(e) => {
								if (cta.onClick) {
									e.preventDefault();
									cta.onClick();
								}
							}}
						>
							{cta.label}
							<ChevronRight className="size-3.5 opacity-70" />
						</a>
					)}
					{user && <UserChip user={user} />}
				</div>

				{/* Mobile Toggle */}
				<div className="flex items-center gap-2 md:hidden">
					{user && (
						<span
							aria-label={user.name}
							className="flex size-8 items-center justify-center rounded-full bg-[var(--sand)] font-semibold text-[var(--palm)] text-xs"
							role="img"
							title={user.name}
						>
							{getUserInitials(user)}
						</span>
					)}
					<button
						aria-controls="mobile-menu"
						aria-expanded={mobileOpen}
						aria-label={mobileOpen ? "Close menu" : "Open menu"}
						className="inline-flex size-10 items-center justify-center rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] transition-colors hover:bg-[var(--link-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lagoon)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--header-bg)]"
						onClick={handleToggle}
						ref={toggleRef}
						type="button"
					>
						{mobileOpen ? (
							<X className="size-5" />
						) : (
							<Menu className="size-5" />
						)}
					</button>
				</div>
			</div>

			{/* Mobile Menu */}
			<AnimatePresence initial={false}>
				{mobileOpen && (
					<motion.div
						animate={{ opacity: 1, height: "auto" }}
						className="overflow-hidden border-[var(--line)] border-b bg-[var(--header-bg)] backdrop-blur-xl md:hidden"
						exit={{ opacity: 0, height: 0 }}
						id="mobile-menu"
						initial={{ opacity: 0, height: 0 }}
						ref={menuRef}
						transition={{
							duration: 0.3,
							ease: [0.25, 1, 0.5, 1],
						}}
					>
						<motion.nav
							animate="open"
							aria-label="Mobile primary"
							className="mx-auto flex max-w-[1200px] flex-col gap-1 px-4 py-4 sm:px-6"
							exit="collapsed"
							initial="collapsed"
							variants={{
								open: {
									transition: { staggerChildren: 0.04, delayChildren: 0.05 },
								},
								collapsed: {
									transition: { staggerChildren: 0.02, staggerDirection: -1 },
								},
							}}
						>
							{navItems.map((item) => (
								<motion.a
									aria-current={item.active ? "page" : undefined}
									className={cn(
										"flex items-center justify-between rounded-xl px-4 py-3.5 font-medium text-base no-underline transition-colors",
										item.active
											? "bg-[var(--sand)] text-[var(--sea-ink)]"
											: "text-[var(--sea-ink-soft)] hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
									)}
									href={item.href}
									key={item.href + item.label}
									onClick={handleClose}
									transition={{
										duration: 0.25,
										ease: [0.25, 1, 0.5, 1],
									}}
									variants={{
										open: { opacity: 1, y: 0 },
										collapsed: { opacity: 0, y: -8 },
									}}
								>
									<span>{item.label}</span>
									{item.badge !== undefined && (
										<span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-[var(--palm)] px-2 py-0.5 font-semibold text-white text-xs leading-none">
											{item.badge}
										</span>
									)}
									{item.active && (
										<ChevronRight className="size-4 text-[var(--lagoon)]" />
									)}
								</motion.a>
							))}

							<div className="mt-3 flex flex-col gap-2 border-[var(--line)] border-t pt-4">
								{secondaryAction && (
									<motion.a
										className="rounded-xl px-4 py-3.5 text-center font-medium text-[var(--sea-ink-soft)] text-base no-underline transition-colors hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
										href={secondaryAction.href || "#"}
										onClick={(e) => {
											if (secondaryAction.onClick) {
												e.preventDefault();
												secondaryAction.onClick();
											}
											handleClose();
										}}
										transition={{
											duration: 0.25,
											ease: [0.25, 1, 0.5, 1],
										}}
										variants={{
											open: { opacity: 1, y: 0 },
											collapsed: { opacity: 0, y: -8 },
										}}
									>
										{secondaryAction.label}
									</motion.a>
								)}
								{cta && (
									<motion.a
										className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--palm)] px-4 py-3.5 font-semibold text-base text-white no-underline shadow-[0_4px_14px_rgba(47,106,74,0.28)] transition-colors hover:bg-[#27633f] active:scale-[0.98]"
										href={cta.href || "#"}
										onClick={(e) => {
											if (cta.onClick) {
												e.preventDefault();
												cta.onClick();
											}
											handleClose();
										}}
										transition={{
											duration: 0.25,
											ease: [0.25, 1, 0.5, 1],
										}}
										variants={{
											open: { opacity: 1, y: 0 },
											collapsed: { opacity: 0, y: -8 },
										}}
									>
										{cta.label}
										<ChevronRight className="size-4" />
									</motion.a>
								)}
							</div>
						</motion.nav>
					</motion.div>
				)}
			</AnimatePresence>
		</header>
	);
}

export default FairLendAnimatedHeader;

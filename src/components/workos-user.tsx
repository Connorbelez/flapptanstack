import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { LogOut } from "lucide-react";
import { useHostAwareSignOut } from "#/hooks/use-host-aware-sign-out";
import { buildSignInRedirect, buildSignUpRedirect } from "#/lib/auth-redirect";

export default function SignInButton({ large }: { large?: boolean }) {
	const { user, signOut } = useAuth();
	const href = useLocation({
		select: (location) => location.href,
	});
	const handleSignOut = useHostAwareSignOut(signOut);

	const buttonClasses = `${
		large ? "px-6 py-3 text-base" : "px-2.5 py-2 text-sm sm:px-4"
	} inline-flex items-center gap-1.5 rounded-full bg-[#0B1220] font-medium text-white transition-colors hover:bg-[#172033] disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-md sm:bg-blue-600 sm:hover:bg-blue-700`;

	if (user) {
		return (
			<div className="flex items-center gap-2 sm:gap-3">
				<div className="flex min-w-0 items-center gap-2">
					{user.profilePictureUrl && (
						<img
							alt={`Avatar of ${user.firstName} ${user.lastName}`}
							className="size-8 shrink-0 rounded-full sm:size-10"
							height={40}
							src={user.profilePictureUrl}
							width={40}
						/>
					)}
					<span className="hidden max-w-40 truncate sm:inline">
						{user.firstName} {user.lastName}
					</span>
				</div>
				<button
					className={buttonClasses}
					onClick={() => {
						void handleSignOut();
					}}
					type="button"
				>
					<LogOut className="size-4 sm:hidden" />
					<span className="hidden sm:inline">Sign Out</span>
					<span className="sr-only sm:hidden">Sign Out</span>
				</button>
			</div>
		);
	}

	return (
		<>
			<Link
				className="rounded-md bg-foreground px-4 py-2 text-background"
				{...buildSignInRedirect(href)}
				viewTransition
			>
				Sign in
			</Link>
			<Link
				className="rounded-md bg-foreground px-4 py-2 text-background"
				{...buildSignUpRedirect(href)}
				viewTransition
			>
				Sign up
			</Link>
		</>
	);
}

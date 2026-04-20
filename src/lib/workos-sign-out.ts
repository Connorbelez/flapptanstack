import { isRouterTeardownSignOutError } from "./workos-auth";

type SignOutFn = (options?: { returnTo?: string }) => Promise<void>;

export async function handleWorkosSignOut(
	signOut: SignOutFn,
	options?: {
		onError?: (message: string) => void;
		returnTo?: string;
	}
) {
	try {
		await signOut(
			options?.returnTo ? { returnTo: options.returnTo } : undefined
		);
	} catch (error) {
		if (isRouterTeardownSignOutError(error)) {
			window.location.href = options?.returnTo ?? "/";
			return;
		}

		const message =
			error instanceof Error
				? error.message
				: "Sign out failed. Please try again.";

		if (options?.onError) {
			options.onError(message);
			return;
		}

		console.error("Sign out failed:", error);
	}
}

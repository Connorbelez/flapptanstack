import { useMutation, useQuery } from "convex/react";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { PlatformInviteResolution } from "./admin-lawyers-model";

export function InvitePlatformLawyerDialog(props: {
	readonly onOpenChange: (open: boolean) => void;
	readonly open: boolean;
}) {
	const [displayName, setDisplayName] = useState("");
	const [email, setEmail] = useState("");
	const [firmName, setFirmName] = useState("");
	const [barNumber, setBarNumber] = useState("");
	const [jurisdiction, setJurisdiction] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const resolution = useQuery(
		api.legalRepresentation.adminLawyers.resolvePlatformLawyerInvite,
		props.open && email.trim().length > 0 ? { email } : "skip"
	) as PlatformInviteResolution | undefined;
	const invitePlatformLawyer = useMutation(
		api.legalRepresentation.adminLawyers.invitePlatformLawyer
	);

	function resetForm() {
		setDisplayName("");
		setEmail("");
		setFirmName("");
		setBarNumber("");
		setJurisdiction("");
		setError(null);
		setIsSubmitting(false);
	}

	function close() {
		resetForm();
		props.onOpenChange(false);
	}

	useEffect(() => {
		if (!props.open) {
			setDisplayName("");
			setEmail("");
			setFirmName("");
			setBarNumber("");
			setJurisdiction("");
			setError(null);
			setIsSubmitting(false);
		}
	}, [props.open]);

	if (!props.open) {
		return null;
	}

	const action = resolution?.recommendedAction ?? "create_pending";
	const submitLabel = platformInviteSubmitLabel(action);

	async function submit() {
		if (!(displayName.trim() && email.trim())) {
			setError("Name and email are required.");
			return;
		}
		setError(null);
		setIsSubmitting(true);
		try {
			await invitePlatformLawyer({
				authId: resolution?.user?.authId ?? undefined,
				barNumber: barNumber.trim() || undefined,
				displayName,
				email,
				firmName: firmName.trim().length > 0 ? firmName : undefined,
				jurisdiction: jurisdiction.trim() || undefined,
				resolution: action,
			});
			close();
		} catch (error) {
			setError(error instanceof Error ? error.message : String(error));
			setIsSubmitting(false);
		}
	}

	return (
		<div aria-label="Invite platform lawyer" aria-modal="true" role="dialog">
			<button
				aria-label="Close invite platform lawyer"
				className="fixed inset-0 z-40 bg-background/80"
				onClick={close}
				type="button"
			/>
			<form
				className="fixed top-1/2 left-1/2 z-50 w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-md border bg-background p-6 shadow-xl"
				onSubmit={(event) => {
					event.preventDefault();
					void submit();
				}}
			>
				<div className="flex items-start justify-between gap-3">
					<div>
						<h2 className="font-semibold text-xl">Invite platform lawyer</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							Start from email and attach WorkOS identity when available.
						</p>
					</div>
					<button
						aria-label="Close invite platform lawyer"
						className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
						onClick={close}
						type="button"
					>
						<X aria-hidden="true" className="size-4" />
					</button>
				</div>
				<label className="mt-4 block font-medium text-sm">
					Email
					<input
						className="mt-1 h-9 w-full rounded-md border bg-background px-3 font-normal"
						name="email"
						onChange={(event) => {
							setError(null);
							setEmail(event.target.value);
						}}
						onInput={(event) => {
							setError(null);
							setEmail(event.currentTarget.value);
						}}
						type="email"
						value={email}
					/>
				</label>
				{resolution?.user ? (
					<div className="mt-3 rounded-md border p-3 text-sm">
						<strong>Existing WorkOS user</strong>
						<p className="text-muted-foreground">
							{resolution.user.displayName} · {resolution.user.email}
						</p>
					</div>
				) : null}
				{resolution?.profile ? (
					<div className="mt-3 rounded-md border p-3 text-sm">
						<strong>Existing lawyer profile</strong>
						<p className="text-muted-foreground">
							{resolution.profile.displayName} ·{" "}
							{resolution.profile.profileKind}
						</p>
					</div>
				) : null}
				<label className="mt-3 block font-medium text-sm">
					Name
					<input
						className="mt-1 h-9 w-full rounded-md border bg-background px-3 font-normal"
						name="displayName"
						onChange={(event) => setDisplayName(event.target.value)}
						onInput={(event) => setDisplayName(event.currentTarget.value)}
						value={displayName}
					/>
				</label>
				<label className="mt-3 block font-medium text-sm">
					Firm
					<input
						className="mt-1 h-9 w-full rounded-md border bg-background px-3 font-normal"
						name="firmName"
						onChange={(event) => setFirmName(event.target.value)}
						onInput={(event) => setFirmName(event.currentTarget.value)}
						value={firmName}
					/>
				</label>
				<div className="mt-3 grid grid-cols-2 gap-3">
					<label className="block font-medium text-sm">
						Bar number
						<input
							className="mt-1 h-9 w-full rounded-md border bg-background px-3 font-normal"
							name="barNumber"
							onChange={(event) => setBarNumber(event.target.value)}
							onInput={(event) => setBarNumber(event.currentTarget.value)}
							value={barNumber}
						/>
					</label>
					<label className="block font-medium text-sm">
						Jurisdiction
						<input
							className="mt-1 h-9 w-full rounded-md border bg-background px-3 font-normal"
							name="jurisdiction"
							onChange={(event) => setJurisdiction(event.target.value)}
							onInput={(event) => setJurisdiction(event.currentTarget.value)}
							value={jurisdiction}
						/>
					</label>
				</div>
				{error ? (
					<p className="mt-3 text-destructive text-sm">{error}</p>
				) : null}
				<div className="mt-5 flex justify-end gap-2">
					<button
						className="rounded-md border px-3 py-2 text-sm"
						onClick={close}
						type="button"
					>
						Cancel
					</button>
					<button
						className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm"
						disabled={isSubmitting}
						type="submit"
					>
						{submitLabel}
					</button>
				</div>
			</form>
		</div>
	);
}

function platformInviteSubmitLabel(
	action:
		| "attach_existing_user"
		| "designate_existing_profile"
		| "create_pending"
) {
	if (action === "attach_existing_user") {
		return "Attach user";
	}
	if (action === "designate_existing_profile") {
		return "Designate profile";
	}
	return "Send invite";
}

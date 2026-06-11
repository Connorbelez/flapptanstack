import type { ComponentProps } from "react";
import { Button } from "#/components/ui/button";

type UnavailableActionButtonProps = Omit<
	ComponentProps<typeof Button>,
	"aria-label" | "disabled" | "title" | "type"
> & {
	readonly action: string;
	readonly reason: string;
};

export function UnavailableActionButton({
	action,
	children,
	reason,
	...props
}: UnavailableActionButtonProps) {
	const label = `${action} unavailable: ${reason}`;

	return (
		<Button {...props} aria-label={label} disabled title={label} type="button">
			{children}
		</Button>
	);
}

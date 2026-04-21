import { HostAccessBoundaryState } from "./HostAccessBoundaryState";

export function WrongPortalState(props: {
	assignedHost: string;
	assignedPortalLabel: string;
	continueHref: string;
	currentHost: string;
}) {
	return (
		<HostAccessBoundaryState
			boundaryKind="wrong-portal"
			continueHref={props.continueHref}
			continueLabel={`Continue to ${props.assignedPortalLabel}`}
			currentHost={props.currentHost}
			expectedHost={props.assignedHost}
		/>
	);
}

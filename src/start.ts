import { createStart } from "@tanstack/react-start";
import { authkitMiddleware } from "@workos/authkit-tanstack-react-start";
import { portalRequestMiddleware } from "#/lib/portal/request-host";

export const startInstance = createStart(() => {
	return {
		requestMiddleware: [authkitMiddleware(), portalRequestMiddleware],
	};
});

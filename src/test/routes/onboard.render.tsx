import type { ReactElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
	fireEvent as domFireEvent,
	screen,
	waitFor,
} from "@testing-library/dom";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

interface MountedRoot {
	container: HTMLDivElement;
	root: Root;
}

const mountedRoots = new Set<MountedRoot>();

export function render(ui: ReactElement) {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const mounted = { container, root };
	mountedRoots.add(mounted);

	act(() => {
		root.render(ui);
	});

	return {
		container,
		rerender(nextUi: ReactElement) {
			act(() => {
				root.render(nextUi);
			});
		},
		unmount() {
			act(() => {
				root.unmount();
			});
			container.remove();
			mountedRoots.delete(mounted);
		},
	};
}

export function cleanup() {
	for (const mounted of mountedRoots) {
		act(() => {
			mounted.root.unmount();
		});
		mounted.container.remove();
	}
	mountedRoots.clear();
}

type FireEventApi = typeof domFireEvent;

export const fireEvent = new Proxy(domFireEvent, {
	get(target, prop: keyof FireEventApi) {
		const eventFn = target[prop];
		if (typeof eventFn !== "function") {
			return eventFn;
		}

		return (...args: unknown[]) => {
			let result: unknown;
			act(() => {
				result = (eventFn as (...eventArgs: unknown[]) => unknown)(...args);
			});
			return result;
		};
	},
}) as FireEventApi;

export { screen, waitFor };

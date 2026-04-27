import { readdirSync } from "node:fs";
import { join } from "node:path";

type ConvexModuleLoader = () => Promise<unknown>;

function compareModuleKeys(a: string, b: string) {
	const aIsRootGenerated = a.startsWith("/convex/_generated/");
	const bIsRootGenerated = b.startsWith("/convex/_generated/");

	if (aIsRootGenerated !== bIsRootGenerated) {
		return aIsRootGenerated ? -1 : 1;
	}

	return a.localeCompare(b);
}

export function loadModulesFromRoot(root: URL, mountPrefix: string) {
	const moduleEntries: [string, ConvexModuleLoader][] = [];

	const walk = (dir: URL, relativePath: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const nextRelativePath = relativePath
				? `${relativePath}/${entry.name}`
				: entry.name;
			const nextUrl = new URL(
				`${entry.name}${entry.isDirectory() ? "/" : ""}`,
				dir
			);

			if (entry.isDirectory()) {
				if (entry.name === "__tests__") {
					continue;
				}
				walk(nextUrl, nextRelativePath);
				continue;
			}

			if (!(entry.name.endsWith(".ts") || entry.name.endsWith(".js"))) {
				continue;
			}

			if (entry.name.endsWith(".d.ts")) {
				continue;
			}

			const moduleKey = join(mountPrefix, nextRelativePath).replaceAll(
				"\\",
				"/"
			);
			moduleEntries.push([moduleKey, () => import(nextUrl.href)]);
		}
	};

	walk(root, "");

	return Object.fromEntries(
		moduleEntries.sort(([leftKey], [rightKey]) =>
			compareModuleKeys(leftKey, rightKey)
		)
	);
}

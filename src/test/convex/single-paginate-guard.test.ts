import fs from "node:fs";
import path from "node:path";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

type ConvexHandlerKind = "action" | "mutation" | "query";

interface GuardIssue {
	filePath: string;
	handlerName: string;
	kind: Exclude<ConvexHandlerKind, "action">;
	reason: string;
}

interface HandlerMetrics {
	maxPaginateCount: number;
	paginateInLoop: boolean;
}

interface HandlerDefinition {
	handler: ts.ArrowFunction | ts.FunctionExpression;
	kind: ConvexHandlerKind;
	name: string;
}

interface AnalyzeEnv {
	cache: Map<ts.Node, HandlerMetrics>;
	localFunctions: Map<
		string,
		ts.ArrowFunction | ts.FunctionDeclaration | ts.FunctionExpression
	>;
}

const QUERY_BUILDERS = new Set(["internalQuery"]);
const MUTATION_BUILDERS = new Set(["internalMutation"]);
const ACTION_BUILDERS = new Set(["internalAction"]);

function combineSequential(parts: HandlerMetrics[]): HandlerMetrics {
	return {
		maxPaginateCount: parts.reduce(
			(total, part) => total + part.maxPaginateCount,
			0
		),
		paginateInLoop: parts.some((part) => part.paginateInLoop),
	};
}

function combineBranch(parts: HandlerMetrics[]): HandlerMetrics {
	return {
		maxPaginateCount: parts.reduce(
			(max, part) => Math.max(max, part.maxPaginateCount),
			0
		),
		paginateInLoop: parts.some((part) => part.paginateInLoop),
	};
}

function isFunctionLike(
	node: ts.Node
): node is
	| ts.ArrowFunction
	| ts.FunctionDeclaration
	| ts.FunctionExpression
	| ts.MethodDeclaration {
	return (
		ts.isArrowFunction(node) ||
		ts.isFunctionDeclaration(node) ||
		ts.isFunctionExpression(node) ||
		ts.isMethodDeclaration(node)
	);
}

function isLoopStatement(node: ts.Node): node is ts.IterationStatement {
	return (
		ts.isDoStatement(node) ||
		ts.isForInStatement(node) ||
		ts.isForOfStatement(node) ||
		ts.isForStatement(node) ||
		ts.isWhileStatement(node)
	);
}

function isPaginateCall(node: ts.Node): node is ts.CallExpression {
	return (
		ts.isCallExpression(node) &&
		ts.isPropertyAccessExpression(node.expression) &&
		node.expression.name.text === "paginate"
	);
}

function getRootIdentifierName(expression: ts.Expression): string | undefined {
	let current: ts.Node = expression;

	while (ts.isCallExpression(current) || ts.isPropertyAccessExpression(current)) {
		current = ts.isCallExpression(current)
			? current.expression
			: current.expression;
	}

	return ts.isIdentifier(current) ? current.text : undefined;
}

function classifyBuilderKind(rootName: string | undefined): ConvexHandlerKind | null {
	if (!rootName) {
		return null;
	}
	if (QUERY_BUILDERS.has(rootName) || /Query$/.test(rootName)) {
		return "query";
	}
	if (MUTATION_BUILDERS.has(rootName) || /Mutation$/.test(rootName)) {
		return "mutation";
	}
	if (ACTION_BUILDERS.has(rootName) || /Action$/.test(rootName)) {
		return "action";
	}
	return null;
}

function collectLocalFunctions(
	sourceFile: ts.SourceFile
): Map<
	string,
	ts.ArrowFunction | ts.FunctionDeclaration | ts.FunctionExpression
> {
	const localFunctions = new Map<
		string,
		ts.ArrowFunction | ts.FunctionDeclaration | ts.FunctionExpression
	>();

	for (const statement of sourceFile.statements) {
		if (ts.isFunctionDeclaration(statement) && statement.name) {
			localFunctions.set(statement.name.text, statement);
			continue;
		}

		if (!ts.isVariableStatement(statement)) {
			continue;
		}

		for (const declaration of statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
				continue;
			}
			if (
				ts.isArrowFunction(declaration.initializer) ||
				ts.isFunctionExpression(declaration.initializer)
			) {
				localFunctions.set(declaration.name.text, declaration.initializer);
			}
		}
	}

	return localFunctions;
}

function extractObjectHandler(
	name: string,
	initializer: ts.CallExpression
): HandlerDefinition | null {
	if (!ts.isIdentifier(initializer.expression)) {
		return null;
	}

	const kind = classifyBuilderKind(initializer.expression.text);
	if (!kind) {
		return null;
	}

	const [config] = initializer.arguments;
	if (!config || !ts.isObjectLiteralExpression(config)) {
		return null;
	}

	for (const property of config.properties) {
		if (
			ts.isPropertyAssignment(property) &&
			ts.isIdentifier(property.name) &&
			property.name.text === "handler" &&
			(ts.isArrowFunction(property.initializer) ||
				ts.isFunctionExpression(property.initializer))
		) {
			return {
				handler: property.initializer,
				kind,
				name,
			};
		}
	}

	return null;
}

function extractChainHandler(
	name: string,
	initializer: ts.Expression
): HandlerDefinition | null {
	let current: ts.Node = initializer;
	let handler: ts.ArrowFunction | ts.FunctionExpression | null = null;

	while (true) {
		if (
			ts.isCallExpression(current) &&
			ts.isPropertyAccessExpression(current.expression) &&
			current.expression.name.text === "handler"
		) {
			const [arg] = current.arguments;
			if (arg && (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg))) {
				handler = arg;
				break;
			}
		}

		if (ts.isCallExpression(current)) {
			current = current.expression;
			continue;
		}
		if (ts.isPropertyAccessExpression(current)) {
			current = current.expression;
			continue;
		}
		break;
	}

	if (!handler) {
		return null;
	}

	const kind = classifyBuilderKind(getRootIdentifierName(initializer));
	if (!kind) {
		return null;
	}

	return {
		handler,
		kind,
		name,
	};
}

function extractExportedHandlers(sourceFile: ts.SourceFile): HandlerDefinition[] {
	const handlers: HandlerDefinition[] = [];

	for (const statement of sourceFile.statements) {
		if (
			!ts.isVariableStatement(statement) ||
			!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
		) {
			continue;
		}

		for (const declaration of statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
				continue;
			}

			const name = declaration.name.text;
			const handler =
				ts.isCallExpression(declaration.initializer)
					? extractObjectHandler(name, declaration.initializer) ??
						extractChainHandler(name, declaration.initializer)
					: extractChainHandler(name, declaration.initializer);

			if (handler) {
				handlers.push(handler);
			}
		}
	}

	return handlers;
}

function analyzeNode(
	node: ts.Node | undefined,
	env: AnalyzeEnv,
	visiting: Set<ts.Node>
): HandlerMetrics {
	if (!node) {
		return { maxPaginateCount: 0, paginateInLoop: false };
	}

	const cached = env.cache.get(node);
	if (cached) {
		return cached;
	}

	if (visiting.has(node)) {
		return { maxPaginateCount: 0, paginateInLoop: false };
	}

	if (isFunctionLike(node)) {
		return { maxPaginateCount: 0, paginateInLoop: false };
	}

	visiting.add(node);

	let result: HandlerMetrics;

	if (isPaginateCall(node)) {
		result = combineSequential([
			{ maxPaginateCount: 1, paginateInLoop: false },
			...node.arguments.map((argument) => analyzeNode(argument, env, visiting)),
			analyzeNode(node.expression.expression, env, visiting),
		]);
	} else if (ts.isBlock(node) || ts.isSourceFile(node)) {
		result = combineSequential(node.statements.map((statement) => analyzeNode(statement, env, visiting)));
	} else if (ts.isIfStatement(node)) {
		result = combineSequential([
			analyzeNode(node.expression, env, visiting),
			combineBranch([
				analyzeNode(node.thenStatement, env, visiting),
				analyzeNode(node.elseStatement, env, visiting),
			]),
		]);
	} else if (ts.isConditionalExpression(node)) {
		result = combineSequential([
			analyzeNode(node.condition, env, visiting),
			combineBranch([
				analyzeNode(node.whenTrue, env, visiting),
				analyzeNode(node.whenFalse, env, visiting),
			]),
		]);
	} else if (ts.isSwitchStatement(node)) {
		result = combineSequential([
			analyzeNode(node.expression, env, visiting),
			combineBranch(
				node.caseBlock.clauses.map((clause) =>
					combineSequential(clause.statements.map((statement) => analyzeNode(statement, env, visiting)))
				)
			),
		]);
	} else if (ts.isTryStatement(node)) {
		result = combineSequential([
			combineBranch([
				analyzeNode(node.tryBlock, env, visiting),
				analyzeNode(node.catchClause?.block, env, visiting),
			]),
			analyzeNode(node.finallyBlock, env, visiting),
		]);
	} else if (isLoopStatement(node)) {
		const loopParts = combineSequential(
			ts.isForStatement(node)
				? [
						analyzeNode(node.initializer, env, visiting),
						analyzeNode(node.condition, env, visiting),
						analyzeNode(node.incrementor, env, visiting),
						analyzeNode(node.statement, env, visiting),
					]
				: ts.isForInStatement(node) || ts.isForOfStatement(node)
					? [
							analyzeNode(node.initializer, env, visiting),
							analyzeNode(node.expression, env, visiting),
							analyzeNode(node.statement, env, visiting),
						]
					: ts.isWhileStatement(node)
						? [
								analyzeNode(node.expression, env, visiting),
								analyzeNode(node.statement, env, visiting),
							]
						: [
								analyzeNode(node.statement, env, visiting),
								analyzeNode(node.expression, env, visiting),
							]
		);

		result = {
			maxPaginateCount: loopParts.maxPaginateCount,
			paginateInLoop:
				loopParts.paginateInLoop || loopParts.maxPaginateCount > 0,
		};
	} else if (
		ts.isBinaryExpression(node) &&
		(node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
			node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
			node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
	) {
		result = combineSequential([
			analyzeNode(node.left, env, visiting),
			combineBranch([
				{ maxPaginateCount: 0, paginateInLoop: false },
				analyzeNode(node.right, env, visiting),
			]),
		]);
	} else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
		const callee = env.localFunctions.get(node.expression.text);
		if (callee) {
			result = combineSequential([
				...node.arguments.map((argument) => analyzeNode(argument, env, visiting)),
				analyzeNode(callee.body, env, visiting),
			]);
		} else {
			result = combineSequential(
				node.getChildren().map((child) => analyzeNode(child, env, visiting))
			);
		}
	} else {
		result = combineSequential(
			node
				.getChildren()
				.filter((child) => !isFunctionLike(child))
				.map((child) => analyzeNode(child, env, visiting))
		);
	}

	visiting.delete(node);
	env.cache.set(node, result);
	return result;
}

function analyzeSourceText(filePath: string, sourceText: string): GuardIssue[] {
	const sourceFile = ts.createSourceFile(
		filePath,
		sourceText,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS
	);
	const env: AnalyzeEnv = {
		cache: new Map(),
		localFunctions: collectLocalFunctions(sourceFile),
	};

	const issues: GuardIssue[] = [];
	for (const handler of extractExportedHandlers(sourceFile)) {
		if (handler.kind === "action") {
			continue;
		}

		const metrics = analyzeNode(handler.handler.body, env, new Set());
		if (metrics.paginateInLoop) {
			issues.push({
				filePath,
				handlerName: handler.name,
				kind: handler.kind,
				reason: "paginate call reachable from inside a loop",
			});
			continue;
		}
		if (metrics.maxPaginateCount > 1) {
			issues.push({
				filePath,
				handlerName: handler.name,
				kind: handler.kind,
				reason: `multiple paginate paths detected (max=${metrics.maxPaginateCount})`,
			});
		}
	}

	return issues;
}

function collectConvexFiles(directory: string): string[] {
	const entries = fs.readdirSync(directory, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const resolved = path.join(directory, entry.name);

		if (entry.isDirectory()) {
			if (
				resolved.includes(`${path.sep}demo${path.sep}`) ||
				resolved.includes(`${path.sep}__tests__${path.sep}`) ||
				resolved.includes(`${path.sep}test${path.sep}`) ||
				resolved.includes(`${path.sep}_generated${path.sep}`)
			) {
				continue;
			}
			files.push(...collectConvexFiles(resolved));
			continue;
		}

		if (entry.isFile() && resolved.endsWith(".ts") && !resolved.endsWith(".d.ts")) {
			files.push(resolved);
		}
	}

	return files;
}

describe("single paginate guard", () => {
	it("allows branch-exclusive single paginate handlers", () => {
		const safeSource = `
			import { internalQuery } from "../_generated/server";

			async function paginateByMode(ctx: any, mode: string, paginationOpts: any) {
				switch (mode) {
					case "a":
						return ctx.db.query("foo").paginate(paginationOpts);
					default:
						return ctx.db.query("bar").paginate(paginationOpts);
				}
			}

			export const listSafe = internalQuery({
				handler: async (ctx) => {
					return paginateByMode(ctx, "a", { cursor: null, numItems: 10 });
				},
			});
		`;

		expect(analyzeSourceText("safe.ts", safeSource)).toEqual([]);
	});

	it("flags sequential multi-paginate paths and paginate-in-loop paths", () => {
		const badSource = `
			import { internalMutation, internalQuery } from "../_generated/server";

			async function collectAll(ctx: any) {
				let cursor = null;
				while (true) {
					const page = await ctx.db.query("foo").paginate({ cursor, numItems: 10 });
					if (page.isDone) {
						return page;
					}
					cursor = page.continueCursor;
				}
			}

			export const badQuery = internalQuery({
				handler: async (ctx) => {
					await ctx.db.query("foo").paginate({ cursor: null, numItems: 10 });
					return ctx.db.query("bar").paginate({ cursor: null, numItems: 10 });
				},
			});

			export const badMutation = internalMutation({
				handler: async (ctx) => {
					return collectAll(ctx);
				},
			});
		`;

		const issues = analyzeSourceText("bad.ts", badSource);

		expect(issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					handlerName: "badQuery",
					reason: expect.stringContaining("multiple paginate paths"),
				}),
				expect.objectContaining({
					handlerName: "badMutation",
					reason: "paginate call reachable from inside a loop",
				}),
			])
		);
	});

	it("passes across production convex query and mutation handlers", () => {
		const convexRoot = path.join(process.cwd(), "convex");
		const issues = collectConvexFiles(convexRoot).flatMap((filePath) =>
			analyzeSourceText(filePath, fs.readFileSync(filePath, "utf8"))
		);

		expect(issues).toEqual([]);
	});
});

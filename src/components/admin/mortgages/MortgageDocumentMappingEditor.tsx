"use client";

import { Button } from "#/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";

export interface MortgageDocumentMappingOverrides {
	signatories: Array<{
		dealParticipantRole: string;
		templatePlatformRole: string;
	}>;
	variables: Array<{
		dealVariableKey: string;
		templateVariableKey: string;
	}>;
}

interface MortgageDocumentMappingEditorProps {
	readonly allowedPlatformRoles: readonly string[];
	readonly allowedVariableKeys: readonly string[];
	readonly defaultSignatoryMappings?: ReadonlyMap<string, string>;
	readonly defaultVariableMappings?: ReadonlyMap<string, string>;
	readonly mappingOverrides: MortgageDocumentMappingOverrides;
	readonly onChange: (overrides: MortgageDocumentMappingOverrides) => void;
	readonly requiredPlatformRoles: readonly string[];
	readonly requiredVariableKeys: readonly string[];
}

export function MortgageDocumentMappingEditor({
	allowedPlatformRoles,
	allowedVariableKeys,
	defaultSignatoryMappings,
	defaultVariableMappings,
	mappingOverrides,
	onChange,
	requiredPlatformRoles,
	requiredVariableKeys,
}: MortgageDocumentMappingEditorProps) {
	const variableOverrides = new Map(
		mappingOverrides.variables.map((row) => [
			row.templateVariableKey,
			row.dealVariableKey,
		])
	);
	const signatoryOverrides = new Map(
		mappingOverrides.signatories.map((row) => [
			row.templatePlatformRole,
			row.dealParticipantRole,
		])
	);

	function setVariableOverride(
		templateVariableKey: string,
		dealVariableKey: string
	) {
		onChange({
			...mappingOverrides,
			variables: [
				...mappingOverrides.variables.filter(
					(row) => row.templateVariableKey !== templateVariableKey
				),
				{ dealVariableKey, templateVariableKey },
			],
		});
	}

	function resetVariable(templateVariableKey: string) {
		onChange({
			...mappingOverrides,
			variables: mappingOverrides.variables.filter(
				(row) => row.templateVariableKey !== templateVariableKey
			),
		});
	}

	function setSignatoryOverride(
		templatePlatformRole: string,
		dealParticipantRole: string
	) {
		onChange({
			...mappingOverrides,
			signatories: [
				...mappingOverrides.signatories.filter(
					(row) => row.templatePlatformRole !== templatePlatformRole
				),
				{ dealParticipantRole, templatePlatformRole },
			],
		});
	}

	function resetSignatory(templatePlatformRole: string) {
		onChange({
			...mappingOverrides,
			signatories: mappingOverrides.signatories.filter(
				(row) => row.templatePlatformRole !== templatePlatformRole
			),
		});
	}

	return (
		<div className="space-y-5">
			<MappingTable
				allowedValues={allowedVariableKeys}
				defaultMappings={defaultVariableMappings}
				label="Variable mappings"
				onReset={resetVariable}
				onSet={setVariableOverride}
				overrides={variableOverrides}
				rows={requiredVariableKeys}
			/>
			<MappingTable
				allowedValues={allowedPlatformRoles}
				defaultMappings={defaultSignatoryMappings}
				label="Signatory mappings"
				onReset={resetSignatory}
				onSet={setSignatoryOverride}
				overrides={signatoryOverrides}
				rows={requiredPlatformRoles}
			/>
		</div>
	);
}

function MappingTable({
	allowedValues,
	defaultMappings,
	label,
	onReset,
	onSet,
	overrides,
	rows,
}: {
	readonly allowedValues: readonly string[];
	readonly defaultMappings?: ReadonlyMap<string, string>;
	readonly label: string;
	readonly onReset: (key: string) => void;
	readonly onSet: (key: string, value: string) => void;
	readonly overrides: ReadonlyMap<string, string>;
	readonly rows: readonly string[];
}) {
	return (
		<section className="space-y-2">
			<h3 className="font-medium text-sm">{label}</h3>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Template placeholder</TableHead>
						<TableHead>Mapping</TableHead>
						<TableHead className="w-32">Action</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row) => {
						const selectedValue =
							overrides.get(row) ??
							defaultMappings?.get(row) ??
							(allowedValues.includes(row) ? row : undefined);

						return (
							<TableRow key={row}>
								<TableCell className="font-mono text-xs">{row}</TableCell>
								<TableCell>
									<Select
										onValueChange={(value) => onSet(row, value)}
										value={selectedValue ?? ""}
									>
										<SelectTrigger
											aria-label={`Mapping for ${row}`}
											className="w-full"
										>
											<SelectValue placeholder="Choose mapping" />
										</SelectTrigger>
										<SelectContent className="z-[70]" position="popper">
											{allowedValues.map((value) => (
												<SelectItem key={value} value={value}>
													{value}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{selectedValue ? null : (
										<p className="mt-1 text-muted-foreground text-xs">
											Unresolved. Choose a mapping.
										</p>
									)}
								</TableCell>
								<TableCell>
									<Button
										aria-label={`Reset ${row}`}
										onClick={() => onReset(row)}
										size="sm"
										type="button"
										variant="ghost"
									>
										Reset
									</Button>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</section>
	);
}

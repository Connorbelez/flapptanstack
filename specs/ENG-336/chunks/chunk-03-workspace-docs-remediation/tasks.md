# Chunk: chunk-03-workspace-docs-remediation

- [x] T-030: Create `VelocityWorkspacePage` using the detail DTO from `getVelocityPackageWorkspace`.
- [x] T-031: Render locked Velocity-owned identity, borrower, property, mortgage, condition, note, and provenance sections.
- [x] T-032: Render editable FairLend-owned bank input, activation remediation fields, staff notes, valuation/listing support fields, and save wiring through `updateVelocityPackageFairLendFields`.
- [x] T-033: Create `VelocityDocumentPanel` and wire PDF upload/link controls through `uploadDocumentAsset`, document asset functions, and `linkVelocityPackageDocument`.
- [x] T-034: Wire `Sync now` to `syncVelocityPackageNow` and show backend result/error state.
- [x] T-035: Render blockers, warnings, exception history, snapshot history, PAD state, and downstream final-review/activation handoff without activation actions.

# Chunk: chunk-02-transition-enforcement

- [x] T-110: Enforce `LAWYER_VERIFIED` verification gate at the deal transition command path so admin/manual paths cannot bypass evidence.
- [x] T-120: Enforce `REPRESENTATION_CONFIRMED` in `confirmRepresentation` with active authorized lawyer plus signed engagement evidence.
- [x] T-130: Preserve `LAWYER_APPROVED_DOCUMENTS` package readiness blockers and add regression coverage if touched.
- [x] T-140: Ensure rejected gate failures surface non-sensitive reason codes through existing Convex errors/transition audit surfaces.

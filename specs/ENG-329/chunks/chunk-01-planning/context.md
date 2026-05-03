# Chunk Context: chunk-01-planning

## Goal
- Turn the Linear issue, Notion plan, and supporting docs into concrete local execution artifacts that are detailed enough to implement ENG-329 without repeatedly reopening the upstream planning workspace.
- Satisfy the pre-edit safety gates: GitNexus impact analysis and `validate_execution_artifacts.py --stage ready-to-edit`.

## Relevant plan excerpts
- "Ship the sticky right-rail shell for /lender/portfolio with Actions Required above the broker chat surface."
- "This issue owns the generic operational rail shell, the generic action host, and the broker chat surface."
- "Consume the explicit broker-coordination contract from ENG-308: assigned broker identity, availability state, fallback contact CTA data, optional thread identifier, and prefill context payloads."
- "Do not invent broker identity, availability, or chat state locally in React."

## Implementation notes
- The current frontend already has the sticky rail host in `LenderPortfolioPage.tsx`; ENG-329 should swap the placeholder content for real leaf components instead of rewriting the page shell or query seam.
- The current backend contract already carries the needed action and broker-coordination shapes, so the planning focus is frontend composition, interaction wiring, and focused test coverage.
- GitNexus indexing initially did not include the current worktree, so the repo was reindexed locally before impact analysis.

## Existing code touchpoints
- `specs/ENG-329/*`
- `src/components/lender/portfolio/LenderPortfolioPage.tsx`
- `convex/portfolio/contracts.ts`
- `convex/portfolio/helpers.ts`

## Validation
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-329 --repo-root "/Users/connor/.codex/worktrees/6886/fairlendapp" --stage ready-to-edit`

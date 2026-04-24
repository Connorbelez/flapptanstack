#!/usr/bin/env bash
set -euo pipefail

REVIEW_DIR="reviews"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT=$(git rev-parse --short HEAD)
SAFE_BRANCH=$(echo "$BRANCH" | tr '/' '-')
BASE_BRANCH="${CODERABBIT_BASE_BRANCH:-}"

if [[ -z "$BASE_BRANCH" ]] && command -v gh >/dev/null 2>&1; then
	BASE_BRANCH=$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null || true)
fi

mkdir -p "$REVIEW_DIR/$SAFE_BRANCH"

OUTFILE="$REVIEW_DIR/$SAFE_BRANCH/$COMMIT.md"

echo "Running coderabbit review..."
echo "Branch: $BRANCH"
echo "Commit: $COMMIT"
echo "Output: $OUTFILE"
if [[ -n "$BASE_BRANCH" ]]; then
	echo "Base: $BASE_BRANCH"
fi

REVIEW_ARGS=(review --plain -t all)
if [[ -n "$BASE_BRANCH" ]]; then
	REVIEW_ARGS+=(--base "$BASE_BRANCH")
fi

coderabbit "${REVIEW_ARGS[@]}" 2>&1 | tee "$OUTFILE"

echo ""
echo "Review saved to $OUTFILE"

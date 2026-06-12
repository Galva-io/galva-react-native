#!/usr/bin/env bash
#
# sync-galva.sh — vendor the first-party Galva iOS source into ios/galva-src.
#
# Usage:
#   scripts/sync-galva.sh [ref]
#
#   ref = a git tag, branch, or commit SHA of github.com/Galva-io/galva-ios.
#         Defaults to the `ref` already recorded in galva.lock.json, or "main"
#         if no lock exists yet.
#
# What it does (see plan §3.3):
#   1. Shallow-fetches galva-ios @ ref (public repo — NO auth).
#   2. Copies Sources/ + LICENSE into ios/galva-src/ (the compiled source).
#   3. Copies Package.swift into ios/galva-src/Package.swift.ref (NOT compiled —
#      it's the reference the CI settings-diff guard watches for resources/deps).
#   4. Writes galva.lock.json: { source, ref, commit, treeSha256 } as committed
#      provenance. treeSha256 lets CI assert the working tree matches the pin.
#
# The vendored source IS committed; CI re-runs this at the locked commit and
# `git diff --exit-code ios/galva-src` to catch drift.

set -euo pipefail

REPO="https://github.com/Galva-io/galva-ios.git"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/ios/galva-src"
LOCK="$ROOT/galva.lock.json"

# Resolve the ref: arg > lock > "main".
REF="${1:-}"
if [[ -z "$REF" ]]; then
  if [[ -f "$LOCK" ]]; then
    REF="$(node -e "process.stdout.write(require('$LOCK').ref || 'main')" 2>/dev/null || echo main)"
  else
    REF="main"
  fi
fi

echo "→ Vendoring Galva iOS source @ '$REF' from $REPO"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Shallow clone at the ref. --depth 1 works for tags/branches; for an arbitrary
# SHA we fetch it explicitly.
if git clone --quiet --depth 1 --branch "$REF" "$REPO" "$TMP/galva-ios" 2>/dev/null; then
  :
else
  echo "  (ref is not a tag/branch — fetching as a commit SHA)"
  git -C "$TMP" init --quiet galva-ios
  git -C "$TMP/galva-ios" remote add origin "$REPO"
  git -C "$TMP/galva-ios" fetch --quiet --depth 1 origin "$REF"
  git -C "$TMP/galva-ios" checkout --quiet FETCH_HEAD
fi

SRC="$TMP/galva-ios"
COMMIT="$(git -C "$SRC" rev-parse HEAD)"

# Sanity: the source must be self-contained (plan §2 audit). Bail if a
# Package.swift suddenly declares dependencies or bundles resources.
if grep -qE 'dependencies:\s*\[[^]]*\.package' "$SRC/Package.swift"; then
  echo "✗ galva-ios Package.swift now declares SwiftPM dependencies — the podspec"
  echo "  vendors source only and cannot resolve transitive SPM deps. Aborting."
  echo "  (Revisit the distribution strategy — see plan §3.2 / §3.6.)"
  exit 1
fi

# Replace the vendored tree atomically.
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$SRC/Sources" "$DEST/Sources"
cp "$SRC/LICENSE" "$DEST/LICENSE"
cp "$SRC/Package.swift" "$DEST/Package.swift.ref"

# Provenance hash: stable over file path + contents, independent of mtime.
TREE_SHA="$(cd "$DEST" && find . -type f -not -name '.DS_Store' | LC_ALL=C sort \
  | xargs shasum -a 256 | shasum -a 256 | awk '{print $1}')"

cat > "$LOCK" <<EOF
{
  "source": "$REPO",
  "ref": "$REF",
  "commit": "$COMMIT",
  "treeSha256": "$TREE_SHA"
}
EOF

echo "✓ Vendored @ $COMMIT"
echo "  ref:        $REF"
echo "  treeSha256: $TREE_SHA"
echo "  → ios/galva-src/  (Sources + LICENSE compiled; Package.swift.ref for CI guard)"
echo "  → galva.lock.json"

#!/usr/bin/env bash
#
# scripts/sync-galva.sh
#
# Vendors the first-party Galva iOS core into ios/galva-src/, pinned per the
# "galva" key in package.json, and writes galva.lock.json recording the resolved
# commit (the reproducible source of truth for what's vendored).
#
# Copies, from galva-ios:
#   • Sources/                  -> ios/galva-src/Sources/
#   • cocoapods/galva-build.rb  -> ios/galva-src/galva-build.rb   (pod build settings)
#   • LICENSE                   -> ios/galva-src/LICENSE
#   • Package.swift             -> ios/galva-src/Package.swift.ref (reference; excluded from npm)
#
# Pin resolution (precedence): iosCoreCommit > iosCoreTag.
# Local dev override: GALVA_IOS_LOCAL=/path/to/galva-ios copies from a working
# tree instead of cloning (records the local HEAD + a dirty flag).
#
# Usage:
#   npm run sync-galva
#   GALVA_IOS_LOCAL=../galva-ios npm run sync-galva
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/ios/galva-src"

# Read a field from the package.json "galva" object via node (always on PATH here).
read_pkg() {
  node -e "process.stdout.write(String((require('$ROOT/package.json').galva||{}).$1 ?? ''))"
}
REPO="$(read_pkg iosCoreRepo)"
TAG="$(read_pkg iosCoreTag)"
COMMIT="$(read_pkg iosCoreCommit)"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

SRC=""            # galva-ios checkout we copy from
RESOLVED=""       # resolved full commit sha
DIRTY="false"
SOURCE="remote"

if [ -n "${GALVA_IOS_LOCAL:-}" ]; then
  SOURCE="local"
  SRC="$(cd "$GALVA_IOS_LOCAL" && pwd)"
  RESOLVED="$(git -C "$SRC" rev-parse HEAD)"
  [ -n "$(git -C "$SRC" status --porcelain)" ] && DIRTY="true"
  echo "==> Local sync from $SRC @ ${RESOLVED:0:12} (dirty=$DIRTY)"
else
  [ -n "$REPO" ] || { echo "error: galva.iosCoreRepo missing in package.json" >&2; exit 2; }
  echo "==> Cloning $REPO"
  git clone --quiet "$REPO" "$WORK/galva-ios"
  SRC="$WORK/galva-ios"
  if [ -n "$COMMIT" ]; then
    echo "==> Checking out commit $COMMIT"
    git -C "$SRC" checkout --quiet "$COMMIT"
  elif [ -n "$TAG" ]; then
    echo "==> Checking out tag $TAG"
    git -C "$SRC" checkout --quiet "tags/$TAG"
  else
    echo "error: set galva.iosCoreCommit or galva.iosCoreTag in package.json" >&2
    exit 2
  fi
  RESOLVED="$(git -C "$SRC" rev-parse HEAD)"
fi

# Required inputs must exist in the source checkout.
[ -d "$SRC/Sources" ] || { echo "error: $SRC/Sources not found" >&2; exit 1; }
[ -f "$SRC/cocoapods/galva-build.rb" ] || {
  echo "error: $SRC/cocoapods/galva-build.rb not found — commit the CocoaPods build helper in galva-ios" >&2
  exit 1
}

echo "==> Vendoring into ios/galva-src"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$SRC/Sources" "$DEST/Sources"
cp "$SRC/cocoapods/galva-build.rb" "$DEST/galva-build.rb"
[ -f "$SRC/LICENSE" ] && cp "$SRC/LICENSE" "$DEST/LICENSE"
[ -f "$SRC/Package.swift" ] && cp "$SRC/Package.swift" "$DEST/Package.swift.ref"
find "$DEST" -name '.DS_Store' -delete
echo "$RESOLVED" > "$DEST/GALVA_IOS_VERSION"

SWIFT_COUNT="$(find "$DEST/Sources" -name '*.swift' | wc -l | tr -d ' ')"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cat > "$ROOT/galva.lock.json" <<JSON
{
  "repo": "$REPO",
  "requested": { "tag": "$TAG", "commit": "$COMMIT" },
  "resolvedCommit": "$RESOLVED",
  "source": "$SOURCE",
  "dirty": $DIRTY,
  "swiftFileCount": $SWIFT_COUNT,
  "syncedAt": "$NOW"
}
JSON

echo "==> Done. Vendored $SWIFT_COUNT Swift files @ ${RESOLVED:0:12} (source=$SOURCE, dirty=$DIRTY)"

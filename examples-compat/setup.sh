#!/usr/bin/env bash
set -euo pipefail
# Packs @galva/react-native from the repo root and installs it into each compat
# app AS A CONSUMER WOULD — from a tarball, not a workspace symlink — so the
# published `files`/`exports` maps, podspec, and autolinking are what's tested.
#
# Each app's package.json declares the dependency as
#   "file:../.galva/galva-react-native.tgz"
# (a REAL dependency entry is required: React Native autolinking discovers
# native modules by scanning package.json dependencies, not node_modules).
# This script refreshes that tarball, then runs npm install.
#
# Usage:  ./setup.sh                  # all apps
#         ./setup.sh rn070-oldarch    # one app

cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"

echo "→ packing @galva/react-native from $ROOT"
mkdir -p .galva
TGZ_NAME="$(cd "$ROOT" && npm pack --pack-destination /tmp 2>/dev/null | tail -1)"
mv "/tmp/$TGZ_NAME" .galva/galva-react-native.tgz
echo "→ refreshed .galva/galva-react-native.tgz"

APPS=("${@:-rn070-oldarch expo54-oldarch expo56-newarch}")
# shellcheck disable=SC2068
for app in ${APPS[@]}; do
  echo "→ [$app] npm install"
  # The lockfile pins the PREVIOUS tarball's integrity hash (same version) —
  # npm would silently reinstall the stale cached copy. Drop it (gitignored).
  (cd "$app" && rm -f package-lock.json && rm -rf node_modules/@galva && npm install --legacy-peer-deps)
done

cat <<'EOF'

Done. Next steps per app (see README.md for details):
  rn070-oldarch   : cd rn070-oldarch/ios && pod install        (then build with Xcode 26)
  expo54-oldarch  : cd expo54-oldarch  && npx expo prebuild    (old arch — newArchEnabled=false)
  expo56-newarch  : cd expo56-newarch  && npx expo prebuild    (new arch default)
EOF

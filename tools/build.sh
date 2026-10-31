#!/bin/sh
# Headless Cocos Creator 2.4.15 build. Usage: sh tools/build.sh <platform> [debug]
# Platforms: web-mobile | web-desktop | android | ios | mac | win32
# Override the editor location with COCOS_CREATOR=/path/to/CocosCreator
set -e
PLATFORM="${1:-web-mobile}"
DEBUG="${2:-false}"
CREATOR="${COCOS_CREATOR:-/Applications/Cocos/Creator/2.4.15/CocosCreator.app/Contents/MacOS/CocosCreator}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ ! -x "$CREATOR" ]; then
  echo "Cocos Creator not found at $CREATOR. Set COCOS_CREATOR." >&2
  exit 1
fi
echo "Building $PLATFORM (debug=$DEBUG) from $ROOT"
"$CREATOR" --path "$ROOT" --build "platform=$PLATFORM;debug=$DEBUG;buildPath=$ROOT/build"
echo "Output: $ROOT/build/$PLATFORM"

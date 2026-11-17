#!/usr/bin/env bash
# Exit codes of `reel-studio` (roadmap M7): 0 success, 1 usage, 2 invalid
# storyboard, 3 engine not running. Run: npm run cli:verify
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI="node $ROOT/bin/reel-studio.mjs"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"
fail=0
expect() { # name expected actual
  if [ "$2" = "$3" ]; then echo "ok   $1 (exit $3)"; else echo "FAIL $1: expected exit $2, got $3"; fail=1; fi
}

$CLI examples >/dev/null 2>&1
expect "examples copies the golden storyboards" 1 "$([ -f explainer.json ] && echo 1 || echo 0)"

$CLI lint explainer.json >/dev/null 2>&1; expect "lint a valid storyboard" 0 $?
echo '{"version":1,"title":"x","scenes":[{"type":"nope"}]}' | $CLI lint - >/dev/null 2>&1; expect "lint an invalid storyboard" 2 $?
echo 'not json' | $CLI render - >/dev/null 2>&1; expect "render piped invalid JSON" 2 $?
echo '{"version":1,"title":"x","scenes":[{"type":"nope"}]}' | $CLI render - 2>err.txt >/dev/null; code=$?
expect "render piped invalid storyboard" 2 $code
grep -q "expected:" err.txt && echo "ok   errors name path, expected and example" || { echo "FAIL errors lack expected/example"; fail=1; }
REEL_STUDIO_URL=http://127.0.0.1:9 $CLI render explainer.json >/dev/null 2>&1; expect "render without an engine" 3 $?
$CLI render >/dev/null 2>&1; expect "render without a file" 1 $?
$CLI bogus >/dev/null 2>&1; expect "unknown command" 1 $?
$CLI schema | head -c 1 | grep -q "{" && echo "ok   schema prints JSON" || { echo "FAIL schema"; fail=1; }

exit $fail

#!/usr/bin/env bash
# Linux: bash diagnose.sh  (Windows uses diagnose.bat)
exec bash "$(cd "$(dirname "$0")" && pwd)/scripts/claude-keys.sh" diagnose "$@"

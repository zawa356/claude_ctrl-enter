#!/usr/bin/env bash
# Linux: bash install.sh  (Windows uses install.bat)
exec bash "$(cd "$(dirname "$0")" && pwd)/scripts/claude-keys.sh" install "$@"

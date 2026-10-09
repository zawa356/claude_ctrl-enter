#!/usr/bin/env bash
# Linux: bash uninstall.sh  (Windows uses uninstall.bat)
exec bash "$(cd "$(dirname "$0")" && pwd)/scripts/claude-keys.sh" uninstall "$@"

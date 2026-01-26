#!/bin/bash
# Dependency installation script for Claude Code on the web
# This script runs automatically when a Claude Code session starts

set -e

# Example: Only run in remote environments
if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  echo "Skipping installation: Not running in Claude Code remote environment."
  exit 0
fi

echo "Starting dependency installation in remote environment..."
echo "Node version: $(node --version)"
echo "pnpm version: $(pnpm --version)"

echo "Running pnpm install..."
pnpm install

echo "Dependency installation completed successfully."
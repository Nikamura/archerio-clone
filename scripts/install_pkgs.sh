#!/bin/bash
# Dependency installation script for Claude Code on the web
# This script runs automatically when a Claude Code session starts

# Example: Only run in remote environments
if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  exit 0
fi

pnpm install
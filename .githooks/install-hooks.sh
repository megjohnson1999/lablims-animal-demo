#!/bin/bash

# Install development hooks for Animal Research LIMS
echo "🔧 Installing development hooks for Animal Research LIMS..."

HOOKS_DIR=".githooks"
GIT_HOOKS_DIR=".git/hooks"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a git repository. Run this from the project root."
    exit 1
fi

# Create git hooks directory if it doesn't exist
mkdir -p "$GIT_HOOKS_DIR"

# Install pre-commit hook
if [ -f "$HOOKS_DIR/pre-commit" ]; then
    cp "$HOOKS_DIR/pre-commit" "$GIT_HOOKS_DIR/pre-commit"
    chmod +x "$GIT_HOOKS_DIR/pre-commit"
    echo "✅ Installed pre-commit hook (schema update reminder)"
else
    echo "❌ Warning: $HOOKS_DIR/pre-commit not found"
fi

echo ""
echo "🎉 Development hooks installed successfully!"
echo ""
echo "📋 Installed hooks:"
echo "  • pre-commit: Reminds to update db/schema.sql with database changes"
echo ""
echo "💡 These hooks help maintain single-command deployment:"
echo "   psql -f db/schema.sql"
echo ""
echo "🔧 To disable hooks temporarily: git commit --no-verify"
echo "🗑️  To uninstall hooks: rm .git/hooks/*"
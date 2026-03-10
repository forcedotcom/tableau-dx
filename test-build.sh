#!/bin/bash
# Test script to verify the generated HTML is valid

echo "Testing erd-history.js compilation..."

# Check if the compiled file exists
if [ ! -f "out/webviews/erd-history.js" ]; then
    echo "❌ Compiled file not found!"
    exit 1
fi

echo "✅ Compiled file exists"

# Check file size
SIZE=$(wc -c < "out/webviews/erd-history.js")
echo "File size: $SIZE bytes"

# Count lines
LINES=$(wc -l < "out/webviews/erd-history.js")
echo "Line count: $LINES lines"

# Check for syntax errors (basic check)
node -c "out/webviews/erd-history.js" 2>&1 && echo "✅ Node.js syntax check passed" || echo "❌ Syntax error found"

echo ""
echo "Next steps:"
echo "1. Completely quit VS Code"
echo "2. Restart VS Code"
echo "3. Test the extension"

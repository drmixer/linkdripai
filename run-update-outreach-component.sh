#!/bin/bash

echo "======================================================"
echo "  Updating Outreach Component"
echo "  Target: Add fallback options when email is not available"
echo "======================================================"

# Run the TypeScript file
npx tsx scripts/handle-outreach-fallback.ts

echo "Component update completed!"
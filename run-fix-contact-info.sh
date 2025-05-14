#!/bin/bash

echo "======================================================"
echo "  Running Contact Information Format Fix"
echo "  Target: Consistent data structure across all opportunities"
echo "======================================================"

# Run the TypeScript file
npx tsx scripts/fix-inconsistent-contact-info.ts

echo "Fix completed!"
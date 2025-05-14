#!/bin/bash

echo "======================================================"
echo "  Running Contact Information Coverage Analysis"
echo "  Target: Detailed metrics on current contact coverage"
echo "======================================================"

# Run the TypeScript file
npx tsx scripts/analyze-contact-coverage.ts

echo "Analysis completed!"
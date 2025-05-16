#!/bin/bash

echo "======================================================="
echo "  Running Contact Coverage Analysis"
echo "  Detailed statistics on contact information"
echo "======================================================="

# Execute the script with Node
npx tsx scripts/analyze-contact-coverage.ts

echo "Analysis completed!"
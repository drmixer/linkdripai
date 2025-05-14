#!/bin/bash

echo "======================================================="
echo "  Running Enhanced Email Extractor"
echo "  Using multiple free techniques to improve email discovery"
echo "======================================================="

# Process regular opportunities first
echo "Processing regular opportunities..."
npx tsx scripts/enhanced-email-extractor.ts --skip-premium --limit=20

# If the first run completes successfully, run again for premium opportunities
if [ $? -eq 0 ]; then
  echo "Processing premium opportunities..."
  npx tsx scripts/enhanced-email-extractor.ts --only-premium
fi

echo "Enhanced email extraction completed!"
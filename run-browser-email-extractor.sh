#!/bin/bash

echo "======================================================="
echo "  Running Browser-Powered Email Extractor"
echo "  Advanced email extraction with Puppeteer"
echo "======================================================="

# Check if the premium flag is provided
if [ "$1" == "--premium-only" ]; then
  echo "Processing PREMIUM opportunities only (DA 40+)"
  npx tsx scripts/browser-email-extractor.ts --premium-only
else
  echo "Processing ALL opportunities without emails"
  npx tsx scripts/browser-email-extractor.ts
fi

echo "Browser-based email extraction completed!"
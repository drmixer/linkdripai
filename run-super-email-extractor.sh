#!/bin/bash

echo "======================================================="
echo "  Running Super Email Extractor"
echo "  Advanced contact email extraction"
echo "======================================================="

# Check if the premium flag is provided
if [ "$1" == "--premium-only" ]; then
  echo "Processing PREMIUM opportunities only (DA 40+)"
  npx tsx scripts/super-email-extractor.ts --premium-only
else
  echo "Processing ALL opportunities without emails"
  npx tsx scripts/super-email-extractor.ts
fi

echo "Email extraction completed!"
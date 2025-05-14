#!/bin/bash

# Run the advanced contact extractor script
# This script uses a comprehensive multi-tiered approach to extract contact info
# with a target of 90-95% coverage for premium and 65-80% overall

# Import the .env file if it exists
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Set proper Node options for memory optimization
export NODE_OPTIONS="--max-old-space-size=2048"

# Run the extraction script with options
# --premium-only: Focus only on premium opportunities
# --batch-size: Number of opportunities to process in one run
# --dry-run: Test without updating the database

echo "Running advanced contact extraction..."

# Process 10 opportunities at a time, focusing on premium
npx tsx scripts/advanced-contact-extractor.ts --premium-only --batch-size 10

echo "Contact extraction completed!"
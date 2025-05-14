#!/bin/bash

# Super Contact Extractor Script
# This script runs the most advanced contact extraction techniques
# to maximize our contact coverage rates, especially for premium sites

# Import the .env file if it exists
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Set proper Node options for memory optimization
export NODE_OPTIONS="--max-old-space-size=2048"

echo "======================================================"
echo "  Running Super Contact Extractor"
echo "  Target: 85-95% overall coverage, 100% premium"
echo "======================================================"

# Run the super extractor
npx tsx scripts/super-contact-extractor.ts

echo "Extraction completed!"
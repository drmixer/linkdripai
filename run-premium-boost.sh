#!/bin/bash

# Premium Contact Booster Script
# This script targets premium opportunities with a faster, more efficient approach
# to quickly boost our coverage metrics

# Import the .env file if it exists
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Set proper Node options for memory optimization
export NODE_OPTIONS="--max-old-space-size=2048"

echo "======================================================"
echo "  Running Premium Contact Booster"
echo "  Target: 100% premium coverage"
echo "======================================================"

# Run the premium contact booster
npx tsx scripts/premium-contact-boost.ts

echo "Boost completed!"
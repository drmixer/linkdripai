#!/bin/bash

# Quick contact coverage check
# This script runs a quick check of current contact information coverage rates

# Import the .env file if it exists
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Set proper Node options for memory optimization
export NODE_OPTIONS="--max-old-space-size=2048"

echo "Running quick contact coverage check..."
npx tsx scripts/quick-contact-check.ts

echo "Check completed!"
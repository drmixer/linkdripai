#!/bin/bash

# Run the improved contact extraction script
# This script prioritizes premium opportunities and helps reach our contact coverage targets

# Import the .env file if it exists
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Set proper Node options for memory optimization
export NODE_OPTIONS="--max-old-space-size=2048"

echo "Running improved contact extraction..."
npx tsx scripts/improved-contact-extraction.ts

echo "Extraction completed!"
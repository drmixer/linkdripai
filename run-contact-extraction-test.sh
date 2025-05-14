#!/bin/bash

# Run the contact extraction test on a single opportunity
# This script tests the extraction process on a single premium opportunity
# Useful for verifying the extraction works without processing the entire database

# Import the .env file if it exists
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Set proper Node options for memory optimization
export NODE_OPTIONS="--max-old-space-size=2048"

# Run the script
echo "Running contact extraction test on a single opportunity..."
npx tsx scripts/test-contact-extraction.ts

echo "Test completed!"
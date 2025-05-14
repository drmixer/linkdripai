#!/bin/bash

# Run a simplified contact extraction test
# This script tests basic contact extraction on a known domain
# without relying on the advanced extraction methods

# Import the .env file if it exists
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Set proper Node options for memory optimization
export NODE_OPTIONS="--max-old-space-size=2048"

echo "Running simple contact extraction test..."
npx tsx scripts/simple-contact-test.ts

echo "Test completed!"
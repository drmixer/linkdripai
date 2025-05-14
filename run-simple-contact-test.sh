#!/bin/bash

# Run the simple contact extraction test
# This script tests the extraction process on a predefined list of domains
# to verify the extraction functionality works properly

# Import the .env file if it exists
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Set proper Node options for memory optimization
export NODE_OPTIONS="--max-old-space-size=2048"

# Run the script
echo "Running simple contact extraction test..."
npx tsx scripts/run-simple-contact-test.ts

echo "Test completed!"
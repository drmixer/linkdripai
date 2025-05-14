#!/bin/bash

# Run the fixed contact coverage script with improved performance and reliability
# This script uses more intelligent throttling and error handling to extract contact info

# Import the .env file if it exists
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Set proper Node options for memory optimization
export NODE_OPTIONS="--max-old-space-size=2048"

# Run the script
echo "Running improved contact information extraction..."
npx tsx scripts/fixed-contact-coverage.ts

echo "Contact extraction completed!"
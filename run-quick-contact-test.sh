#!/bin/bash

# Run the quick contact check
# This script quickly checks the contact information coverage stats
# without the detailed analysis that might cause timeouts

# Import the .env file if it exists
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Set proper Node options for memory optimization
export NODE_OPTIONS="--max-old-space-size=2048"

# Run the script
echo "Running quick contact coverage check..."
npx tsx scripts/quick-contact-check.ts

echo "Check completed!"
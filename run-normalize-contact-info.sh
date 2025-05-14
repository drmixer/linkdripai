#!/bin/bash

# Contact Info Normalizer Script
# This script normalizes all contact information to ensure a consistent format

# Import the .env file if it exists
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Set proper Node options for memory optimization
export NODE_OPTIONS="--max-old-space-size=2048"

echo "======================================================"
echo "  Running Contact Information Normalizer"
echo "  Target: Consistent data format across all opportunities"
echo "======================================================"

# Run the normalizer script
npx tsx scripts/normalize-contact-info.ts

echo "Normalization completed!"
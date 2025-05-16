#!/bin/bash

echo "======================================================="
echo "  Running Contact Information Normalization"
echo "  This will standardize all contact info formats"
echo "======================================================="

# Execute the script with Node
npx tsx scripts/normalize-contact-info.ts

echo "Normalization completed!"
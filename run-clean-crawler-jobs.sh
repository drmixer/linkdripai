#!/bin/bash

echo "======================================================="
echo "  Running Stalled Crawler Job Cleanup"
echo "  This will terminate crawler jobs running for >1 hour"
echo "======================================================="

# Execute the script with Node
npx tsx scripts/clean-stalled-crawler-jobs.ts

echo "Cleanup completed!"
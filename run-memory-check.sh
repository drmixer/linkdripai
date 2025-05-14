#!/bin/bash

echo "======================================================="
echo "  Running System Resource Check"
echo "  Checking for memory leaks and performance issues"
echo "======================================================="

npx tsx scripts/check-memory-usage.ts

echo "Memory check completed!"
#!/bin/bash

echo "LinkDripAI Quick Contact Extractor Test"
echo "======================================"
echo "This script tests the advanced contact extractor on a small sample of opportunities."
echo "No database changes will be made during this test."
echo ""

npx tsx scripts/quick-contact-test.ts

echo ""
echo "Quick test completed!"
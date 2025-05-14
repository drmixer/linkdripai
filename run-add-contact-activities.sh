#!/bin/bash

echo "======================================================"
echo "  Running Migration: Add Contact Activities Table"
echo "  Target: Create unified contact activity tracking system"
echo "======================================================"

# Run the migration script
npx tsx scripts/add-contact-activities-table.ts

echo "Contact activities migration completed!"
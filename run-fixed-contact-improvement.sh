#!/bin/bash

echo "LinkDripAI Fixed Contact Information Coverage Improvement Tool"
echo "==========================================================="
echo "This tool significantly improves contact information coverage for opportunities."
echo ""

# Initialize variables with default values
DRY_RUN=""
PREMIUM_ONLY=""
BATCH_SIZE=""

# Process command line arguments
for arg in "$@"
do
    case $arg in
        --dry-run)
        DRY_RUN="--dry-run"
        echo "🔍 Running in DRY RUN mode (no database updates will be performed)"
        ;;
        --premium-only)
        PREMIUM_ONLY="--premium-only"
        echo "⭐ Processing PREMIUM OPPORTUNITIES ONLY"
        ;;
        --batch-size=*)
        BATCH_SIZE="--batch-size=${arg#*=}"
        echo "📦 Setting batch size to ${arg#*=}"
        ;;
        --help)
        echo "Usage: ./run-fixed-contact-improvement.sh [options]"
        echo ""
        echo "Options:"
        echo "  --dry-run            Run without making database changes"
        echo "  --premium-only       Process only premium opportunities"
        echo "  --batch-size=N       Process opportunities in batches of N"
        echo "  --help               Show this help message"
        echo ""
        exit 0
        ;;
    esac
done

echo ""
echo "Starting fixed contact coverage improvement process..."
echo ""

# Build the command with any specified options
COMMAND="npx tsx scripts/run-fixed-contact-coverage.ts"

if [ -n "$DRY_RUN" ] || [ -n "$PREMIUM_ONLY" ] || [ -n "$BATCH_SIZE" ]; then
    COMMAND="$COMMAND $DRY_RUN $PREMIUM_ONLY $BATCH_SIZE"
fi

# Run the contact improvement tool with the constructed command
echo $COMMAND
eval $COMMAND

echo ""
echo "✅ Fixed contact coverage improvement process completed!"
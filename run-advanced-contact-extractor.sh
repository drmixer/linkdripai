#!/bin/bash

echo "LinkDripAI Advanced Contact Extractor"
echo "====================================="
echo "This tool significantly improves contact information coverage using a multi-tiered approach."
echo ""

# Initialize variables with default values
DRY_RUN=""
PREMIUM_ONLY=""
BATCH_SIZE=""
LIMIT=""

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
        --limit=*)
        LIMIT="--limit=${arg#*=}"
        echo "🔢 Limiting to ${arg#*=} opportunities"
        ;;
        --help)
        echo "Usage: ./run-advanced-contact-extractor.sh [options]"
        echo ""
        echo "Options:"
        echo "  --dry-run            Run without making database changes"
        echo "  --premium-only       Process only premium opportunities"
        echo "  --batch-size=N       Process opportunities in batches of N"
        echo "  --limit=N            Process a maximum of N opportunities"
        echo "  --help               Show this help message"
        echo ""
        echo "Examples:"
        echo "  ./run-advanced-contact-extractor.sh --dry-run"
        echo "  ./run-advanced-contact-extractor.sh --premium-only --batch-size=10"
        echo "  ./run-advanced-contact-extractor.sh --limit=50"
        echo ""
        exit 0
        ;;
    esac
done

echo ""
echo "Starting advanced contact extraction process..."
echo ""

# Build the command with any specified options
COMMAND="npx tsx scripts/run-advanced-contact-extractor.ts"

if [ -n "$DRY_RUN" ] || [ -n "$PREMIUM_ONLY" ] || [ -n "$BATCH_SIZE" ] || [ -n "$LIMIT" ]; then
    COMMAND="$COMMAND --"
    
    if [ -n "$DRY_RUN" ]; then
        COMMAND="$COMMAND $DRY_RUN"
    fi
    
    if [ -n "$PREMIUM_ONLY" ]; then
        COMMAND="$COMMAND $PREMIUM_ONLY"
    fi
    
    if [ -n "$BATCH_SIZE" ]; then
        COMMAND="$COMMAND $BATCH_SIZE"
    fi
    
    if [ -n "$LIMIT" ]; then
        COMMAND="$COMMAND $LIMIT"
    fi
fi

# Run the contact extraction tool with the constructed command
eval $COMMAND

echo ""
echo "✅ Advanced contact extraction process completed!"
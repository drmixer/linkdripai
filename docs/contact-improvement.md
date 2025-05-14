# LinkDripAI Contact Information Improvement

This document explains how to improve contact information coverage for both regular and premium opportunities in LinkDripAI.

## Current Status

As of May 14, 2025:
- Total opportunities: 876
- With contact info: 332 (38% coverage)
- Premium opportunities: 100
- Premium with contact info: 54 (54% coverage)
- DA distribution: 32.6% are DA 60+

## Goals

Our target coverage goals are:
- 65-80% overall contact information coverage (currently 38%)
- 90-95% coverage for premium opportunities (currently 54%)

## Improvement Process

We've created a comprehensive contact information extraction system that:

1. Prioritizes premium opportunities for processing
2. Uses multiple advanced techniques to find contact information:
   - Multi-page crawling (main page, contact, about, team pages)
   - Advanced email pattern detection including obfuscated emails
   - Comprehensive contact form detection
   - Social media profile extraction with username parsing
   - Intelligent throttling and retry mechanisms

## Usage

To run the contact information improvement process:

```bash
# Run the script (for actual database updates)
./run-contact-improvement.sh

# Run in dry run mode (no database changes)
./run-contact-improvement.sh --dry-run
```

This will:
1. Process premium opportunities without contact info first
2. Then process regular opportunities until we reach target coverage

The script will show progress and statistics throughout the extraction process.

### Dry Run Mode

The `--dry-run` flag allows you to test the contact extraction process without making any actual changes to the database. This is useful for:

- Testing the extraction logic
- Verifying connection to external websites
- Estimating how many opportunities would be updated
- Checking for any potential errors or issues

## Technical Implementation

The extraction system includes several key components:

1. **Email Detection**: Comprehensive patterns to detect standard, obfuscated, and protected email formats
2. **Contact Page Discovery**: Intelligent crawling of contact, about, and team pages
3. **Social Media Extraction**: Pattern matching for major platforms with username parsing
4. **Rate Limiting & Retries**: Smart throttling to avoid being blocked
5. **Structured Data Processing**: Extraction from schema.org JSON-LD when available

## Maintaining Contact Coverage

To maintain high contact coverage:

1. Run the improvement script weekly to process new opportunities
2. Monitor coverage rates with SQL queries
3. Update extraction patterns as websites evolve their obfuscation techniques

## Results

After running the contact improvement process, we expect:
- 65-80% overall coverage (550-700 opportunities with contact info)
- 90-95% premium coverage (90-95 premium opportunities with contact info)

This significantly improves the value proposition of LinkDripAI by providing actionable contact information for outreach.
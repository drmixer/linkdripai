# Advanced Contact Extraction System for LinkDripAI

The Advanced Contact Extraction System is a high-performance solution designed to significantly improve contact information coverage for all opportunities in LinkDripAI, with special focus on premium opportunities.

## Key Features

- **Multi-tiered extraction approach** that combines multiple sophisticated techniques
- **Intelligent throttling and caching** to avoid overloading target websites
- **Advanced pattern recognition** for finding obfuscated email addresses
- **Comprehensive social media detection** with username and profile data extraction
- **Progressive fallback mechanisms** to ensure maximum data recovery
- **Batch processing** with configurable sizes to optimize performance
- **Premium-first prioritization** to ensure highest quality opportunities have contact data

## Target Coverage Goals

- **65-80%** overall contact information coverage
- **90-95%** coverage for premium opportunities

## Contact Data Extracted

The system extracts the following types of contact information:

1. **Email addresses** - including obfuscated and encoded formats
2. **Contact form URLs** - direct links to contact forms
3. **Social media profiles** - with platform, username and additional metadata
4. **Phone numbers** - in various international formats
5. **Physical addresses** - when available

## Usage

To run the advanced contact extraction process:

```bash
# Run the script (for actual database updates)
./run-advanced-contact-extractor.sh

# Run in dry run mode (no database changes)
./run-advanced-contact-extractor.sh --dry-run

# Process only premium opportunities
./run-advanced-contact-extractor.sh --premium-only

# Set a custom batch size
./run-advanced-contact-extractor.sh --batch-size=20

# Limit the number of opportunities to process
./run-advanced-contact-extractor.sh --limit=100

# Combine options
./run-advanced-contact-extractor.sh --premium-only --batch-size=10 --limit=50
```

## Extraction Process Details

The system employs a multi-stage extraction process for each opportunity:

1. **Primary Extraction**: First attempts to extract contact information from the opportunity's source URL
2. **Contact Page Crawling**: If primary extraction doesn't yield complete information, crawls common contact page paths
3. **Deep Content Analysis**: Analyzes HTML structure, meta tags, microdata, and structured data
4. **Pattern Recognition**: Uses sophisticated regular expressions to detect various contact patterns
5. **Email Format Generation**: When no emails are found, generates potential domain-based email formats

## Throttling and Error Handling

To ensure responsible scraping and avoid overwhelming target websites:

- Implements domain-based request throttling (default: 5 seconds between requests to the same domain)
- Uses exponential backoff with jitter for retries
- Caches successful requests to avoid redundant fetching
- Rotates user agents to avoid detection
- Handles network errors gracefully with multiple retry attempts

## Performance Considerations

- Processing time varies based on the number of opportunities and their complexity
- The script can be safely interrupted and restarted (it will continue with unprocessed opportunities)
- For very large datasets, consider using the `--limit` option to process in manageable chunks
- Premium opportunities are always prioritized for processing

## Extending the System

The extraction system is designed to be extensible:

- Add new email detection patterns in the `EMAIL_PATTERNS` array
- Add new social media platforms in the `SOCIAL_PLATFORMS` array
- Modify throttling parameters via the constants at the top of the script

## Technical Implementation

The extraction system includes several key components:

- **URL Cleanup and Normalization**: Standardizes URLs for consistent processing
- **Domain Extraction**: Identifies the primary domain for each opportunity
- **HTML Fetching**: Retrieves and parses page content with retry logic
- **Pattern Matching**: Uses regular expressions to identify contact information
- **Structured Data Extraction**: Parses JSON-LD and other structured formats
- **Contact Page Discovery**: Finds dedicated contact pages beyond the main URL
- **Batch Processing**: Processes opportunities in configurable batches

## Tips for Best Results

- Run in `--dry-run` mode first to test without making database changes
- Start with `--premium-only` to prioritize high-value opportunities
- Use smaller batch sizes (10-20) for more stable operation
- For initial testing, use `--limit=50` to process a smaller subset
- Run the script during off-peak hours to minimize impact on target websites
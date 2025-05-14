# Improved Contact Information Extraction

This document outlines the improvements made to LinkDripAI's contact information extraction system to increase coverage and reliability.

## Current Status

As of May 14, 2025:
- Total opportunities: 890
- Current contact information coverage: 38.9% overall
- Premium opportunity coverage: 54%
- Target coverage: 65-80% overall, 90-95% for premium opportunities

## Improvements Made

### 1. Performance Optimization

- **Reduced Request Timeout**: Adjusted timeout settings from 30,000ms to 15,000ms for faster detection of unresponsive servers
- **Optimized Batch Size**: Reduced default batch size from 20 to 10 for more manageable processing chunks
- **Intelligent Throttling**: Added smarter domain-based throttling with root domain extraction to prevent rate limiting

### 2. Error Handling Enhancements

- **Specific Error Type Handling**: Added tailored responses for different types of network errors:
  - Rate limiting (429): Uses extended backoff times
  - Connection refused: Fails fast without retries
  - Timeouts: Uses exponential backoff with jitter
- **Root Domain Extraction**: Prevents subdomains from bypassing throttling mechanisms
- **Exponential Backoff**: Improved retry logic with increasing delays between attempts

### 3. Domain Processing

- **Better Domain Extraction**: Enhanced domain name parsing with special handling for compound TLDs (.co.uk, .com.au, etc.)
- **Contact Page Discovery**: Optimized delays between checking contact pages

## Running the Improved Extraction

There are two methods to run the improved contact extraction:

### 1. Full Extraction

For a full extraction process that updates the database:

```bash
./run-improved-contact-extraction.sh
```

This script will:
1. Process premium opportunities first to maximize high-value contacts
2. Use intelligent throttling to avoid rate limiting
3. Apply exponential backoff for failed requests
4. Provide detailed progress reporting

### 2. Testing

For testing the extraction on a single opportunity without updating the database:

```bash
./run-contact-extraction-test.sh
```

For a faster, simplified test using known good domains:

```bash
./run-simple-contact-test.sh
```

The test scripts are useful for verifying that the extraction methods are working correctly without processing the entire database.

## Expected Outcomes

The improvements are expected to:
- Increase overall contact coverage to 65-80%
- Increase premium contact coverage to 90-95%
- Reduce script execution failures due to timeouts and rate limiting
- Improve script completion time by handling errors more efficiently

## Technical Details

- Extraction uses a multi-stage approach:
  1. Primary extraction from main page
  2. Contact page crawling and analysis
  3. Social media profile extraction
  4. Deep content analysis
- Root domain extraction helps prevent rate limiting by identifying the core domain name rather than treating each subdomain as separate
- Error backoff uses jitter to prevent synchronized retries
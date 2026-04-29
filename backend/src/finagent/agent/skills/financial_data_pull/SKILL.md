---
name: financial-data-pull
description: Use this skill when you need to fetch market/fundamental/SEC data using the available financial tools.
---

# financial-data-pull

## Overview
This skill explains how to use FinAgent financial tools to fetch data reliably and return it in a structured format.

## Instructions
- Prefer tool calls over guessing values.
- For fundamentals, start with Yahoo fundamentals; use Alpha Vantage as backup.
- For SEC filings, require a CIK and return recent filings with dates and form types.
- Return results as:
  - compact bullet points for humans, and
  - a small JSON-like structure when it helps downstream analysis.


# SQL-Based Source Hunter - Implementation Plan

## Architecture

```
PostgreSQL Function: run_source_hunter_sql()
├─ Step 1: Load sources (min_priority >= 5)
├─ Step 2: Load segments
├─ Step 3: For each (segment, source):
│  ├─ Generate query via OpenAI (http POST)
│  ├─ Search via Perplexity (http POST)
│  └─ Save documents + segment links
└─ Step 4: Return summary

Called by: pg_cron every hour/day
```

## SQL Functions to Create

### 1. `generate_query_openai(segment_name, source_name, prompt_template)`
- Calls OpenAI API via http extension
- Returns: focused search query string

### 2. `search_perplexity(query, source_url)`
- Calls Perplexity API via http extension  
- Returns: array of URLs

### 3. `save_document_with_segment(title, url, source_id, segment_id)`
- Inserts into documents table
- Creates document_segments link
- Returns: document_id

### 4. `run_source_hunter_sql(profile_id)`
- Main orchestrator function
- Loops through segments × sources
- Calls above functions
- Returns: summary JSON

## API Keys Needed

```sql
-- OpenAI
v_openai_key := 'sk-...';

-- Perplexity  
v_perplexity_key := 'pplx-...';
```

## Estimated Time
- Function 1 (OpenAI): 1 hour
- Function 2 (Perplexity): 1 hour
- Function 3 (Save): 30 min
- Function 4 (Orchestrator): 1.5 hours
- Testing + debugging: 1 hour
**Total: ~5 hours**

## Start Point
Create OpenAI query generation first - это самое простое.

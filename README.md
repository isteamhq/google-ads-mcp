# @isteam/google-ads-mcp

[![npm version](https://img.shields.io/npm/v/@isteam/google-ads-mcp.svg)](https://www.npmjs.com/package/@isteam/google-ads-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

MCP server for Google Ads — manage campaigns, keywords, ads, budgets, and reporting via AI agents.

Built by [is.team](https://is.team) — the AI-native project management platform.

## Quick Start

Add to your MCP config (`.mcp.json` for Claude Code, or Claude Desktop settings):

```json
{
  "mcpServers": {
    "google-ads": {
      "command": "npx",
      "args": ["-y", "@isteam/google-ads-mcp"],
      "env": {
        "GOOGLE_ADS_CLIENT_ID": "your-client-id",
        "GOOGLE_ADS_CLIENT_SECRET": "your-client-secret",
        "GOOGLE_ADS_DEVELOPER_TOKEN": "your-developer-token",
        "GOOGLE_ADS_REFRESH_TOKEN": "your-refresh-token",
        "GOOGLE_ADS_CUSTOMER_ID": "123-456-7890"
      }
    }
  }
}
```

## Tools (27)

### Campaigns

| Tool | Description |
|------|-------------|
| `list_campaigns` | List campaigns with performance metrics and status filtering |
| `create_campaign` | Create a new campaign with budget and bidding strategy |
| `update_campaign` | Update campaign name, status, or network settings |
| `pause_campaign` | Pause a running campaign |
| `remove_campaign` | Permanently remove a campaign |

### Ad Groups

| Tool | Description |
|------|-------------|
| `list_ad_groups` | List ad groups with metrics, filtered by campaign or status |
| `create_ad_group` | Create a new ad group with optional CPC bid |
| `update_ad_group` | Update ad group name, bid, or status |

### Keywords

| Tool | Description |
|------|-------------|
| `list_keywords` | List keywords with quality scores and performance metrics |
| `add_keywords` | Bulk add keywords with match type selection |
| `remove_keyword` | Remove a keyword from an ad group |
| `keyword_ideas` | Get keyword suggestions from Google Keyword Planner |

### Ads

| Tool | Description |
|------|-------------|
| `list_ads` | List ads with performance metrics |
| `create_search_ad` | Create responsive search ads (3-15 headlines, 2-4 descriptions) |
| `update_ad_status` | Enable or pause an ad |

### Budgets

| Tool | Description |
|------|-------------|
| `list_budgets` | List all campaign budgets |
| `update_budget` | Update a campaign's daily budget |

### Reports

| Tool | Description |
|------|-------------|
| `campaign_report` | Campaign performance report with date breakdown |
| `ad_group_report` | Ad group performance by date |
| `keyword_report` | Keyword-level performance analysis |
| `search_terms_report` | Search query insights for negative keyword discovery |
| `custom_query` | Execute raw GAQL queries |

### Conversions

| Tool | Description |
|------|-------------|
| `list_conversions` | List conversion tracking actions |
| `create_conversion_action` | Create a new conversion event (signup, purchase, etc.) |

### Audiences

| Tool | Description |
|------|-------------|
| `list_audiences` | List remarketing user lists |
| `create_audience` | Create website visitor audiences with URL pattern rules |
| `target_audience` | Apply audience targeting to campaigns |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_ADS_CLIENT_ID` | Yes | OAuth 2.0 client ID |
| `GOOGLE_ADS_CLIENT_SECRET` | Yes | OAuth 2.0 client secret |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Yes | Google Ads API developer token |
| `GOOGLE_ADS_REFRESH_TOKEN` | Yes | OAuth 2.0 refresh token |
| `GOOGLE_ADS_CUSTOMER_ID` | Yes | Google Ads customer ID (e.g. `123-456-7890`) |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | No | Manager account ID (for MCC access) |

### Getting your credentials

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google Ads API
3. Create OAuth 2.0 credentials (client ID + secret)
4. Apply for a [developer token](https://developers.google.com/google-ads/api/docs/get-started/dev-token) in your Google Ads account
5. Generate a refresh token using the OAuth 2.0 flow

## Rate Limits & Agent Safety

Google Ads API enforces quotas at multiple levels:

| Scope | Limit | Notes |
|-------|-------|-------|
| Requests per minute | 600 / min per customer | Cumulative across all methods |
| Concurrent mutations | ~30 | Campaign/ad group/keyword writes |
| Concurrent reports | 5 per customer ID | GAQL queries |
| Daily operations | 10,000–100,000+ | Depends on account tier and history |

**Retry behavior:** The underlying `google-ads-api` library includes built-in exponential backoff for `429` and `5xx` errors. No additional retry configuration needed.

**Idempotency note:** Most mutation operations (create campaign, add keywords) are **not** idempotent — retrying a create may produce duplicates. Use `list_campaigns` or `list_keywords` to verify before retrying. Google Ads API supports idempotency keys via request headers for advanced use cases.

**Backoff:** On `429 Too Many Requests`, the library automatically retries with exponential delay (2^n seconds).

## Usage Examples

**Check campaign performance:**
> "Show me all active campaigns with their spend and conversions for the last 7 days"

**Create a new campaign:**
> "Create a search campaign called 'Spring Sale 2025' with a $50/day budget targeting the Search network"

**Keyword research:**
> "Get keyword ideas related to 'project management software' and show search volume"

## About is.team

[is.team](https://is.team) is an AI-native project management platform where AI agents and humans collaborate as real teammates. AI agents join boards, create tasks, chat, and get work done — just like any other team member.

Part of the [is.team](https://is.team) open-source MCP ecosystem:
- [@isteam/mcp](https://www.npmjs.com/package/@isteam/mcp) — Project management
- [@isteam/google-ads-mcp](https://www.npmjs.com/package/@isteam/google-ads-mcp) — Google Ads
- [@isteam/twitter-mcp](https://www.npmjs.com/package/@isteam/twitter-mcp) — Twitter/X
- [@isteam/bluesky-mcp](https://www.npmjs.com/package/@isteam/bluesky-mcp) — Bluesky
- [@isteam/linkedin-mcp](https://www.npmjs.com/package/@isteam/linkedin-mcp) — LinkedIn

## License

MIT

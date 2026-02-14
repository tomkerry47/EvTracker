# Octopus Energy API Reference

Complete reference for Octopus Energy API features used in EvTracker, plus advanced features for future enhancements.

## Table of Contents

1. [Current Implementation](#current-implementation)
2. [API Best Practices](#api-best-practices)
3. [Rate Limiting](#rate-limiting)
4. [Pagination](#pagination)
5. [Advanced Features](#advanced-features)
6. [Future Enhancements](#future-enhancements)

---

## Current Implementation

### What EvTracker Uses Now

**Endpoint:** Consumption Data
```
GET https://api.octopus.energy/v1/electricity-meter-points/{MPAN}/meters/{SERIAL}/consumption/
```

**Parameters:**
- `period_from`: ISO 8601 datetime (e.g., `2024-01-01T00:00:00Z`)
- `period_to`: ISO 8601 datetime
- `page_size`: Results per page (we use 1000, max is typically 25000)
- `order_by`: Sort order (we use `period` for chronological)

**Authentication:**
- HTTP Basic Auth with API key as username, empty password

**Response Format:**
```json
{
  "count": 48,
  "next": "https://api.octopus.energy/v1/...",
  "previous": null,
  "results": [
    {
      "consumption": 3.145,
      "interval_start": "2024-01-01T23:00:00Z",
      "interval_end": "2024-01-01T23:30:00Z"
    }
  ]
}
```

### How We Process It

1. **Fetch consumption data** for date range
2. **Detect charging sessions** by finding intervals with >2 kWh consumption
3. **Group consecutive intervals** into sessions
4. **Calculate totals** (energy, cost, duration)
5. **Store in database** with UK timezone formatting

---

## API Best Practices

### 1. Request Frequency

**For Historic Data (EvTracker's use case):**
- ✅ Batch requests with larger date ranges
- ✅ Import once and store locally
- ✅ Re-import only when needed
- ❌ Don't poll frequently for historic data

**For Real-Time Monitoring:**
- ✅ Poll every 5-10 minutes if needed
- ❌ Don't poll more than once per minute

### 2. Page Size

**Current Implementation:**
- Using `page_size=1000` (good balance)
- API supports up to 25,000 records per page
- For typical imports (7 days), 1000 is sufficient

**Recommendation:**
- Keep 1000 for user imports
- Use 5000+ for bulk/automated imports if needed

### 3. Error Handling

**Already Implemented:**
- Try/catch for network errors
- API error message extraction
- User-friendly error display

**Should Add:**
- Retry logic with exponential backoff
- 429 (Rate Limit) specific handling
- Timeout handling for slow responses

---

## Rate Limiting

### Official Limits

Octopus Energy doesn't publish hard rate limits, but community guidelines suggest:

**Safe Limits:**
- 1-2 requests per second
- Max 100-200 requests per day for personal use
- Larger batches for historic data

**What Triggers Throttling:**
- Too many requests in short time
- Excessive polling (< 1 minute intervals)
- Large page sizes with frequent requests

### EvTracker Impact

**Current Usage Pattern:**
- User triggers import manually
- Single request per import (typically)
- Pagination handled automatically
- **Low risk of hitting limits** ✅

**Recommendations:**
- User imports manually (not automated) - Good ✅
- Could add cooldown timer (e.g., "Last import 30 seconds ago")
- Consider caching imported data to avoid re-imports

---

## Pagination

### How Octopus API Paginating Works

The API returns pagination links:
```json
{
  "count": 1500,
  "next": "https://api.octopus.energy/v1/...?page=2",
  "previous": null,
  "results": [...]
}
```

### Current Implementation

**In `octopus-client.js`:**
```javascript
// We fetch one page with page_size=1000
const response = await axios.get(url, {
  params: {
    page_size: 1000,
    period_from: periodFrom,
    period_to: periodTo
  }
});
```

**Limitation:**
- Only fetches first page
- If user imports >1000 intervals (~20 days of data), some data is missed

### Recommended Enhancement

**Option 1:** Follow `next` links
```javascript
async getAllConsumption(periodFrom, periodTo) {
  let allResults = [];
  let url = `${this.baseURL}/electricity-meter-points/${this.mpan}/meters/${this.serial}/consumption/`;
  let params = { period_from: periodFrom, period_to: periodTo, page_size: 1000 };
  
  while (url) {
    const response = await axios.get(url, { auth: {...}, params });
    allResults = allResults.concat(response.data.results);
    url = response.data.next;
    params = {}; // next URL has params built in
  }
  
  return { results: allResults };
}
```

**Option 2:** Increase page size
```javascript
page_size: 5000  // Handles ~100 days of data
```

**Current Status:**
- For most users (importing 7-30 days), current implementation works fine
- Only becomes issue for bulk imports (>20 days)

---

## Advanced Features

### 1. Intelligent Dispatches API (GraphQL)

**What It Is:**
- Octopus's smart charging schedule API
- Shows planned charging windows
- Dynamically scheduled by Octopus based on grid conditions

**Use Cases:**
- Show upcoming planned charges
- Integrate with smart home automation
- Display charge schedule calendar view

**How to Access:**
```graphql
query getPlannedDispatches($accountNumber: String!) {
  plannedDispatches(accountNumber: $accountNumber) {
    startDtUtc
    endDtUtc
    chargeKwh
    meta {
      source
      location
    }
  }
}
```

**Requirements:**
- Kraken API authentication (different from REST API)
- Account number (in addition to MPAN)
- GraphQL client

**Status:** ⚠️ Not Implemented Yet
- Would require additional setup
- Needs GraphQL support
- Different authentication flow

**Reference:**
- [Python Example](https://gist.github.com/domhauton/2674aefee4f41a45551c55e5e1215870)
- [Home Assistant Integration](https://github.com/BottlecapDave/HomeAssistant-OctopusEnergy)

### 2. Tariff Rates API

**What It Is:**
- Get actual tariff rates from Octopus
- Instead of hardcoding 7.5p/kWh, fetch real rates
- Rates vary by time of day, season, location

**Endpoints:**

**List Products:**
```
GET https://api.octopus.energy/v1/products/
```

**Get Product Details:**
```
GET https://api.octopus.energy/v1/products/{product_code}/
```

**Get Tariff Rates:**
```
GET https://api.octopus.energy/v1/products/{product_code}/electricity-tariffs/{tariff_code}/standard-unit-rates/
```

**Example Product Code:**
- `INTELLIGENT-GO`
- `INTELLI-GO-24-02-27` (dated versions)

**Example Tariff Code:**
- `E-1R-INTELLIGENTGO-22-07-13-E` (Eastern England)
- Format: `E-{rate}-{product}-{region}`

**Use Cases:**
- Automatic rate detection
- Accurate cost calculations
- Historical rate tracking
- Different rates for peak/off-peak

**Implementation Idea:**
```javascript
async getIntelligentGoRates(productCode, tariffCode) {
  const response = await axios.get(
    `${this.baseURL}/products/${productCode}/electricity-tariffs/${tariffCode}/standard-unit-rates/`
  );
  
  // Response contains time-based rates
  return response.data.results;  // Array of {value_exc_vat, value_inc_vat, valid_from, valid_to}
}
```

**Status:** ⚠️ Not Implemented Yet
- Requires product/tariff code discovery
- More complex cost calculation
- Need to match consumption intervals with rate periods

### 3. Account API

**What It Is:**
- Get user's account details
- Find current tariff automatically
- Get MPAN, meter details, agreements

**Endpoint:**
```
GET https://api.octopus.energy/v1/accounts/{account_number}/
```

**Response Includes:**
- Electricity meter points (MPANs)
- Agreements (active tariffs)
- Tariff codes
- Meter serial numbers

**Use Cases:**
- Auto-discover user's tariff
- Validate MPAN/serial
- Multi-meter support
- Historical agreement lookup

**Status:** ⚠️ Not Implemented Yet
- Requires account number (in addition to API key)
- More complex setup flow
- Privacy considerations

---

## Future Enhancements

### Priority 1: Pagination Improvements

**Current Limitation:**
- Only fetches first 1000 consumption intervals
- Imports >20 days may be incomplete

**Enhancement:**
- Follow `next` pagination links
- Fetch all available data for date range
- Add progress indicator for large imports

**Estimated Effort:** Low (2-3 hours)
**User Impact:** High (enables bulk imports)

### Priority 2: Automatic Tariff Detection

**Current Limitation:**
- User must enter tariff rate manually (default 7.5p)
- Rate doesn't change with time/season

**Enhancement:**
- Fetch tariff rates from API
- Match consumption intervals with rate periods
- Calculate accurate costs automatically

**Estimated Effort:** Medium (1-2 days)
**User Impact:** High (accurate cost calculations)

### Priority 3: Planned Dispatches Display

**Current Limitation:**
- Shows only past charges (from consumption)
- No visibility into upcoming charges

**Enhancement:**
- Fetch planned dispatch schedule
- Display upcoming charge windows
- Calendar view of charge schedule
- Notifications for upcoming charges

**Estimated Effort:** High (3-5 days)
**User Impact:** Medium (nice-to-have feature)

### Priority 4: Multi-Meter Support

**Current Limitation:**
- Single MPAN/meter configuration
- Can't track multiple vehicles

**Enhancement:**
- Support multiple MPANs
- Per-vehicle tracking
- Separate statistics per meter

**Estimated Effort:** High (requires database schema changes)
**User Impact:** Low (most users have one meter)

---

## API Resources

### Official Documentation

- **Main Docs:** https://docs.octopus.energy/
- **REST API Reference:** https://developer.octopus.energy/rest/reference/
- **API Basics:** https://docs.octopus.energy/rest/guides/api-basics/
- **Endpoints Guide:** https://developer.octopus.energy/rest/guides/endpoints/

### Community Resources

- **Guy Lipman's Guide:** https://www.guylipman.com/octopus/api_guide.html
- **Home Assistant Integration:** https://github.com/BottlecapDave/HomeAssistant-OctopusEnergy
- **Intelligent Dispatches Gist:** https://gist.github.com/domhauton/2674aefee4f41a45551c55e5e1215870
- **Node-RED Integration:** https://flows.nodered.org/node/node-red-contrib-octopus-intelligent

### Tools & Libraries

- **Python:** `octo-api` - https://octo-api.readthedocs.io/
- **Node.js:** Use axios (what we use) or node-fetch
- **Go:** https://pkg.go.dev/github.com/danopstech/octopusenergy

---

## Support & Help

### Getting Your API Key

1. Log in to https://octopus.energy/
2. Go to Account → Personal Details
3. Scroll to "Developer Settings" or "API Access"
4. Copy your API key (starts with `sk_live_`)

### Finding Your MPAN

- Check your electricity bill
- Look in your Octopus account online
- Format: 13 digits (e.g., `1100010380152`)

### Finding Your Meter Serial

- Check your electricity meter
- Look in your Octopus account online
- Format: alphanumeric (e.g., `18P0140299`)

### Common Issues

**401 Unauthorized:**
- Check API key is correct
- Verify it's your own key (not example key)

**404 Not Found:**
- Check MPAN and serial are correct
- Verify meter is registered with Octopus

**Empty Results:**
- Check date range has consumption data
- Verify meter is smart meter (not analog)
- Try a recent date range (last 7 days)

---

## Changelog

### Current Version (v1.0)

- ✅ Basic consumption data fetching
- ✅ Charging session detection
- ✅ UK timezone handling
- ✅ Manual tariff rate entry
- ✅ Deduplication support
- ✅ Error handling

### Planned (v1.1)

- ⬜ Complete pagination support
- ⬜ Automatic tariff rate fetching
- ⬜ Improved error messages
- ⬜ Import progress indicator

### Future (v2.0)

- ⬜ Planned dispatches API
- ⬜ GraphQL support
- ⬜ Multi-meter support
- ⬜ Historical rate tracking
- ⬜ Smart charging schedule view

---

**For implementation details, see:**
- [lib/octopus-client.js](./lib/octopus-client.js) - Current API client
- [OCTOPUS_API_SETUP.md](./OCTOPUS_API_SETUP.md) - Setup guide
- [OCTOPUS_IMPORT_FIX.md](./OCTOPUS_IMPORT_FIX.md) - Date/time fix details

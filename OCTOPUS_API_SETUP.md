# Octopus Energy API Integration Setup Guide

## Overview

This guide explains how to integrate the Octopus Energy API with EvTracker to automatically fetch:
- Half-hourly electricity consumption data
- Real-time tariff rates (Intelligent Octopus Go pricing)
- Smart charging schedules
- Accurate cost calculations based on actual usage

## ⚠️ Important Notes

- **Current Status**: Octopus API integration is not yet implemented in EvTracker
- **Current Method**: Manual tariff rate entry (default: 7.5p/kWh for off-peak)
- **This Guide**: Provides complete information for implementation

## Octopus Energy API Information

### What is the Octopus Energy API?

Octopus Energy provides a **free, public REST API** that allows you to access:
- ✅ Half-hourly electricity consumption from your smart meter
- ✅ Current and historical tariff rates
- ✅ Account details (MPAN, meter serial numbers)
- ✅ Smart charging schedules (if using Intelligent Octopus integration)

**API Base URL**: `https://api.octopus.energy/v1/`

**API Documentation**: https://developer.octopus.energy/docs/api/

## Getting Started with Octopus Energy API

### Step 1: Obtain Your API Key

1. **Log in to your Octopus Energy account**
   - Visit: https://octopus.energy/dashboard/
   - Sign in with your credentials

2. **Navigate to API Settings**
   - Go to **Personal Details** or **Account Settings**
   - Look for **Development Settings** or **API Access**
   - Or visit directly: https://octopus.energy/dashboard/new/accounts/personal-details/api-access

3. **Generate API Key**
   - Click "Generate API Key" or similar
   - Copy and save your API key securely
   - **Format**: `sk_live_XXXXXXXXXXXXXXXXXXXX`

### Step 2: Find Your Meter Details

You need two pieces of information:

#### MPAN (Meter Point Administration Number)
- **What it is**: Unique identifier for your electricity supply point
- **Where to find it**: 
  - Octopus Energy dashboard
  - Your electricity bill
  - Usually 13 digits (sometimes 21 with leading zeros)
- **Example**: `1100010380152` (your MPAN)

#### Meter Serial Number
- **What it is**: Unique identifier for your physical electricity meter
- **Where to find it**:
  - Octopus Energy dashboard (under "Meter Details")
  - On the physical meter itself
  - Your electricity bill
- **Example**: `18P0140299` (your meter serial)

### Step 3: Configure EvTracker

Once you have your credentials, add them to your environment variables:

**Local Development (.env file):**
```env
# Existing variables
DATABASE_URL=your_neon_connection_string

# Octopus Energy API credentials (add these)
OCTOPUS_API_KEY=sk_live_XXXXXXXXXXXXXXXXXXXX
OCTOPUS_MPAN=1100010380152
OCTOPUS_SERIAL=18P0140299
OCTOPUS_ACCOUNT_NUMBER=A-XXXXXXXX  # Optional, from your dashboard
```

**Vercel Deployment:**
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add each Octopus credential as a separate variable:
   - `OCTOPUS_API_KEY`
   - `OCTOPUS_MPAN`
   - `OCTOPUS_SERIAL`
   - `OCTOPUS_ACCOUNT_NUMBER` (optional)
3. Select all environments (Production, Preview, Development)
4. Redeploy

## API Integration Architecture

### How It Would Work

```
┌─────────────────┐
│  EV Charging    │
│   at Home       │
└────────┬────────┘
         │
         │ Smart meter records usage
         │
┌────────▼────────┐
│  Smart Meter    │
│  (DCC Network)  │
└────────┬────────┘
         │
         │ Data sent every 30 minutes
         │
┌────────▼────────┐
│ Octopus Energy  │
│   API Service   │
└────────┬────────┘
         │
         │ API calls with authentication
         │
┌────────▼────────┐
│   EvTracker     │
│   Server.js     │
└────────┬────────┘
         │
         │ Calculate charging sessions
         │ Match with tariff rates
         │
┌────────▼────────┐
│  Neon Postgres  │
│    Database     │
└─────────────────┘
```

## API Endpoints

### Authentication

All API calls use **Basic Authentication** with your API key as the username and empty password:

```bash
# Format
Authorization: Basic base64(API_KEY:)

# Example using curl
curl -u "sk_live_XXXXXXXXXXXXXXXXXXXX:" https://api.octopus.energy/v1/...
```

### 1. Get Electricity Consumption

**Endpoint:**
```
GET https://api.octopus.energy/v1/electricity-meter-points/{MPAN}/meters/{SERIAL}/consumption/
```

**With Your Credentials:**
```
GET https://api.octopus.energy/v1/electricity-meter-points/1100010380152/meters/18P0140299/consumption/
```

**Query Parameters:**
- `period_from` (optional): ISO 8601 datetime - e.g., `2024-01-01T00:00:00Z`
- `period_to` (optional): ISO 8601 datetime - e.g., `2024-01-31T23:59:59Z`
- `page_size` (optional): Number of results per page (default: 100, max: 25000)
- `order_by` (optional): `period` (ascending) or `-period` (descending)
- `group_by` (optional): Aggregate data - `hour`, `day`, `week`, `month`

**Example Request:**
```bash
curl -u "sk_live_XXXXXXXXXXXXXXXXXXXX:" \
  "https://api.octopus.energy/v1/electricity-meter-points/1100010380152/meters/18P0140299/consumption/?period_from=2024-01-15T23:00:00Z&period_to=2024-01-16T06:00:00Z"
```

**Example Response:**
```json
{
  "count": 14,
  "next": null,
  "previous": null,
  "results": [
    {
      "consumption": 0.113,
      "interval_start": "2024-01-15T23:00:00Z",
      "interval_end": "2024-01-15T23:30:00Z"
    },
    {
      "consumption": 2.456,
      "interval_start": "2024-01-15T23:30:00Z",
      "interval_end": "2024-01-16T00:00:00Z"
    },
    {
      "consumption": 7.234,
      "interval_start": "2024-01-16T00:00:00Z",
      "interval_end": "2024-01-16T00:30:00Z"
    }
    // ... more 30-minute intervals
  ]
}
```

### 2. Get Tariff Rates (Intelligent Octopus Go)

**Endpoint:**
```
GET https://api.octopus.energy/v1/products/{PRODUCT_CODE}/electricity-tariffs/{TARIFF_CODE}/standard-unit-rates/
```

**For Intelligent Octopus Go:**
- Product Code: `INTELLI-VAR-22-10-14` (or current version)
- Tariff Code Format: `E-1R-{PRODUCT_CODE}-{REGION}`
- Region: Check your region code (e.g., `C` for Eastern England)

**Example for Your Region:**
```bash
# You'll need to determine your region code from your Octopus dashboard
curl -u "sk_live_XXXXXXXXXXXXXXXXXXXX:" \
  "https://api.octopus.energy/v1/products/INTELLI-VAR-22-10-14/electricity-tariffs/E-1R-INTELLI-VAR-22-10-14-C/standard-unit-rates/"
```

**Query Parameters:**
- `period_from` (optional): ISO 8601 datetime
- `period_to` (optional): ISO 8601 datetime
- `page_size` (optional): Results per page

**Example Response:**
```json
{
  "count": 2,
  "next": null,
  "previous": null,
  "results": [
    {
      "value_exc_vat": 6.82,
      "value_inc_vat": 7.50,
      "valid_from": "2024-01-15T23:30:00Z",
      "valid_to": "2024-01-16T05:30:00Z",
      "payment_method": null
    },
    {
      "value_exc_vat": 27.27,
      "value_inc_vat": 30.00,
      "valid_from": "2024-01-16T05:30:00Z",
      "valid_to": "2024-01-16T23:30:00Z",
      "payment_method": null
    }
  ]
}
```

### 3. Get Account Information

**Endpoint:**
```
GET https://api.octopus.energy/v1/accounts/{ACCOUNT_NUMBER}/
```

**Example Response:**
```json
{
  "number": "A-XXXXXXXX",
  "properties": [
    {
      "id": 123456,
      "moved_in_at": "2020-01-01T00:00:00Z",
      "electricity_meter_points": [
        {
          "mpan": "1100010380152",
          "profile_class": 1,
          "consumption_standard": 2900,
          "meters": [
            {
              "serial_number": "18P0140299",
              "registers": [
                {
                  "identifier": "1",
                  "rate": "STANDARD",
                  "is_settlement_register": true
                }
              ]
            }
          ],
          "agreements": [
            {
              "tariff_code": "E-1R-INTELLI-VAR-22-10-14-C",
              "valid_from": "2023-01-01T00:00:00Z",
              "valid_to": null
            }
          ]
        }
      ]
    }
  ]
}
```

## Implementation Approach

### Option A: Detect Charging Sessions from Consumption Data

**Strategy**: Analyze half-hourly consumption to detect when EV charging occurred.

**Logic:**
1. Fetch consumption data for a date range
2. Identify periods with high consumption (e.g., > 2 kWh in 30 minutes)
3. Group consecutive high-consumption periods into charging sessions
4. Calculate total energy and cost for each session
5. Store in EvTracker database

**Example Implementation:**
```javascript
async function detectChargingSessions(mpan, serial, dateFrom, dateTo) {
  // Fetch consumption data
  const consumption = await octopusAPI.getConsumption(mpan, serial, {
    period_from: dateFrom,
    period_to: dateTo
  });
  
  const sessions = [];
  let currentSession = null;
  const CHARGING_THRESHOLD = 2.0; // kWh per 30 min
  
  for (const interval of consumption.results) {
    if (interval.consumption >= CHARGING_THRESHOLD) {
      if (!currentSession) {
        // Start new session
        currentSession = {
          startTime: interval.interval_start,
          intervals: [interval]
        };
      } else {
        // Continue existing session
        currentSession.intervals.push(interval);
      }
    } else {
      if (currentSession) {
        // End session
        currentSession.endTime = currentSession.intervals[currentSession.intervals.length - 1].interval_end;
        sessions.push(currentSession);
        currentSession = null;
      }
    }
  }
  
  return sessions.map(transformToEvTrackerFormat);
}
```

### Option B: Manual Matching with Automatic Pricing

**Strategy**: User logs session times manually, app fetches actual consumption and rates.

**Logic:**
1. User enters start/end time for charging session
2. Fetch consumption data for that time period
3. Fetch tariff rates for that time period
4. Calculate actual energy used and cost
5. Store with accurate pricing

**Benefits:**
- More accurate than estimation
- Verifies manual entries
- Provides exact cost breakdown

### Option C: Smart Charging Integration

**Strategy**: If using Intelligent Octopus's smart charging feature.

**Logic:**
1. Fetch smart charging schedules from Octopus API
2. Match scheduled charging windows with consumption data
3. Automatically log sessions when charging occurred
4. Apply correct off-peak rates

## Data Mapping

### Octopus Consumption → EvTracker Session

```javascript
function transformOctopusSession(octopusData, tariffRates) {
  // Calculate totals from half-hourly intervals
  const totalEnergy = octopusData.intervals.reduce((sum, interval) => 
    sum + interval.consumption, 0
  );
  
  // Match intervals with tariff rates and calculate cost
  let totalCost = 0;
  for (const interval of octopusData.intervals) {
    const rate = findRateForTime(tariffRates, interval.interval_start);
    totalCost += (interval.consumption * rate.value_inc_vat) / 100;
  }
  
  // Calculate average rate
  const averageRate = (totalCost / totalEnergy) * 100;
  
  return {
    id: `octopus-${Date.now()}`,
    date: octopusData.startTime.split('T')[0],
    startTime: extractTime(octopusData.startTime),
    endTime: extractTime(octopusData.endTime),
    energyAdded: parseFloat(totalEnergy.toFixed(2)),
    cost: parseFloat(totalCost.toFixed(2)),
    tariffRate: parseFloat(averageRate.toFixed(2)),
    startSoC: null, // Not available from Octopus
    endSoC: null,   // Not available from Octopus
    notes: `Imported from Octopus Energy (${octopusData.intervals.length} intervals)`
  };
}

function findRateForTime(rates, timestamp) {
  return rates.find(rate => 
    new Date(rate.valid_from) <= new Date(timestamp) &&
    new Date(rate.valid_to) > new Date(timestamp)
  );
}

function extractTime(isoString) {
  const date = new Date(isoString);
  return date.toTimeString().slice(0, 5); // HH:MM format
}
```

## Intelligent Octopus Go Tariff

### Current Rates (as of 2024)
- **Off-peak**: 7.5p/kWh (23:30 - 05:30)
- **Peak**: ~30p/kWh (05:30 - 23:30)
- **Smart charge windows**: Variable, determined by Octopus

### Rate Detection

The API provides exact rates with validity periods, so you can:
1. Determine if a session occurred during off-peak
2. Calculate blended rates if session spans multiple periods
3. Track rate changes over time

## Code Example: Full Implementation

```javascript
// lib/octopus-client.js
const axios = require('axios');

class OctopusEnergyClient {
  constructor(apiKey, mpan, serial) {
    this.apiKey = apiKey;
    this.mpan = mpan;
    this.serial = serial;
    this.baseURL = 'https://api.octopus.energy/v1';
  }

  async getConsumption(periodFrom, periodTo, options = {}) {
    const params = {
      period_from: periodFrom,
      period_to: periodTo,
      page_size: options.pageSize || 1000,
      order_by: options.orderBy || 'period'
    };

    const response = await axios.get(
      `${this.baseURL}/electricity-meter-points/${this.mpan}/meters/${this.serial}/consumption/`,
      {
        auth: { username: this.apiKey, password: '' },
        params
      }
    );

    return response.data;
  }

  async getTariffRates(tariffCode, periodFrom, periodTo) {
    const params = {
      period_from: periodFrom,
      period_to: periodTo,
      page_size: 1000
    };

    const response = await axios.get(
      `${this.baseURL}/products/INTELLI-VAR-22-10-14/electricity-tariffs/${tariffCode}/standard-unit-rates/`,
      {
        auth: { username: this.apiKey, password: '' },
        params
      }
    );

    return response.data;
  }

  async getAccountInfo(accountNumber) {
    const response = await axios.get(
      `${this.baseURL}/accounts/${accountNumber}/`,
      {
        auth: { username: this.apiKey, password: '' }
      }
    );

    return response.data;
  }
}

module.exports = OctopusEnergyClient;
```

## Security Considerations

1. **API Key Security**
   - Never commit API keys to Git
   - Use environment variables
   - API key is sensitive but read-only

2. **Rate Limiting**
   - Octopus API has no documented rate limits for personal use
   - Still be respectful: cache data, avoid excessive requests
   - Recommended: Poll every 30 minutes for new consumption data

3. **Data Privacy**
   - Consumption data is personal
   - Store securely in your database
   - Only accessible via authenticated EvTracker sessions

## Testing Your Setup

### 1. Test API Authentication

```bash
# Replace with your actual API key
curl -u "sk_live_XXXXXXXXXXXXXXXXXXXX:" \
  https://api.octopus.energy/v1/electricity-meter-points/1100010380152/meters/18P0140299/consumption/?page_size=1
```

**Expected**: JSON response with consumption data  
**If error**: Check API key, MPAN, and serial number

### 2. Test Recent Consumption

```bash
# Get last 24 hours of consumption
curl -u "sk_live_XXXXXXXXXXXXXXXXXXXX:" \
  "https://api.octopus.energy/v1/electricity-meter-points/1100010380152/meters/18P0140299/consumption/?period_from=$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)"
```

### 3. Verify Charging Session Detection

Look for high consumption periods (> 2 kWh per 30 min interval) that correspond to your known charging times.

## Implementation Checklist

To implement Octopus Energy API integration:

- [ ] Obtain API key from Octopus dashboard
- [ ] Verify MPAN (1100010380152) and Serial (18P0140299)
- [ ] Add credentials to environment variables
- [ ] Create `lib/octopus-client.js` for API calls
- [ ] Implement consumption data fetching
- [ ] Create charging session detection algorithm
- [ ] Fetch and cache tariff rates
- [ ] Calculate accurate costs based on time-of-use
- [ ] Add data transformation layer
- [ ] Handle pagination for large date ranges
- [ ] Implement error handling and retry logic
- [ ] Add cron job or scheduled task for regular imports
- [ ] Create UI for import status and configuration
- [ ] Test with real charging sessions
- [ ] Document any quirks or edge cases found

## Your Specific Setup

Based on the information provided:

```env
# Your Octopus Energy credentials
OCTOPUS_API_KEY=sk_live_XXXXXXXXXXXXXXXXXXXX  # Get from dashboard
OCTOPUS_MPAN=1100010380152
OCTOPUS_SERIAL=18P0140299
```

**Your consumption endpoint:**
```
https://api.octopus.energy/v1/electricity-meter-points/1100010380152/meters/18P0140299/consumption/
```

## Advantages of Octopus API Integration

✅ **Completely Free**: No additional costs  
✅ **Official API**: Well-documented and supported  
✅ **Real Data**: Actual consumption from your smart meter  
✅ **Accurate Pricing**: Exact tariff rates applied  
✅ **Historical Data**: Access past consumption  
✅ **No Hardware**: Works with existing smart meter  
✅ **Reliable**: Backed by Octopus Energy infrastructure  

## Limitations

⚠️ **Granularity**: 30-minute intervals (not real-time)  
⚠️ **Delay**: Consumption data may be 1-2 hours delayed  
⚠️ **Detection**: Can't automatically distinguish EV charging from other high-consumption appliances  
⚠️ **No SoC**: State of Charge not available (car-specific data)  

## Workarounds

1. **Session Detection**: Use consumption threshold + typical charging hours
2. **Verification**: Cross-reference with manually logged sessions
3. **Hybrid Approach**: Manual session times + automatic energy/cost from API

## FAQ

**Q: Is the Octopus Energy API free?**  
A: Yes, completely free for personal use with your own account.

**Q: How often is consumption data updated?**  
A: Typically every 30 minutes, with a 1-2 hour delay from real-time.

**Q: Can I access historical data?**  
A: Yes, consumption data is available for your entire time with Octopus.

**Q: What if I don't have a smart meter?**  
A: The API requires a smart meter (SMETS2) for consumption data.

**Q: How accurate is the consumption data?**  
A: Very accurate - it's the same data used for your billing.

**Q: Can I distinguish EV charging from other usage?**  
A: Not automatically - you'll need to use consumption patterns and timing to infer charging sessions.

**Q: What about solar panels or battery storage?**  
A: The API shows net consumption (import). Export is tracked separately if applicable.

## Support & Resources

- **Octopus API Documentation**: https://developer.octopus.energy/docs/api/
- **Octopus API Forum**: https://forum.octopus.energy/
- **Octopus Support**: help@octopus.energy
- **EvTracker Issues**: https://github.com/tomkerry47/EvTracker/issues

## Contributing

If you implement Octopus API integration:
1. Test thoroughly with real data
2. Document any discoveries or challenges
3. Share your implementation via pull request
4. Help others with similar setups

---

**Last Updated**: 2026-02-13  
**Status**: Documentation only - Implementation pending  
**Your Credentials**: MPAN 1100010380152 | Serial 18P0140299

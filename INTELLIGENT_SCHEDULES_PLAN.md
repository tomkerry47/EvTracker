# Intelligent Octopus Go: Schedule Matching Implementation Plan

## Overview

This document outlines the plan to implement **schedule-based tariff matching** for Intelligent Octopus Go users. This feature will capture planned charging schedules from Octopus Energy and match them against actual consumption to provide the most accurate cost calculations.

## Current Implementation

**Status:** Simple approach - all EV charging uses 7.5p/kWh

**How it works:**
- Import consumption data from Octopus Energy API
- Detect charging sessions (>2 kWh usage)
- Apply 7.5p/kWh smart charging rate to all sessions
- Accurate for typical Intelligent Octopus Go usage

**Limitation:**
- Doesn't distinguish between scheduled charging and excess usage
- Any charging outside planned schedule should be at peak rate (24.5p/kWh)

## Proposed Enhancement: Schedule Matching

### The Concept

**Intelligent Octopus Go provides two data streams:**
1. **Planned Dispatches** - When Octopus plans to charge your car
2. **Actual Consumption** - What you actually used

**By matching these:**
- Charging **within planned schedule** = 7.5p/kWh (smart rate)
- Charging **outside planned schedule** = 24.5p/kWh (peak rate, excess usage)

### Use Cases

**Scenario 1: Perfect Match**
- Planned: 23:00-05:00
- Actual: 23:30-04:30
- Result: All at 7.5p/kWh ✅

**Scenario 2: Excess Usage**
- Planned: 23:00-05:00
- Actual: 23:30-04:30, then 18:00-19:00
- Result: 
  - 23:30-04:30 at 7.5p/kWh
  - 18:00-19:00 at 24.5p/kWh (excess)

**Scenario 3: Manual Boost**
- Planned: 23:00-05:00
- Actual: 15:00-16:00 (user initiated boost)
- Result: 15:00-16:00 at 24.5p/kWh

## Technical Implementation

### Phase 1: Database Schema

Add table to store planned charging schedules:

```sql
CREATE TABLE charging_schedules (
  id SERIAL PRIMARY KEY,
  schedule_date DATE NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  location VARCHAR(255),
  source VARCHAR(50) DEFAULT 'octopus',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_schedule_date (schedule_date),
  INDEX idx_schedule_times (start_time, end_time)
);
```

### Phase 2: Fetch Planned Dispatches

Octopus Energy provides planned dispatches via their **Kraken GraphQL API**.

**Endpoint:** `https://api.octopus.energy/v1/graphql/`

**Authentication:** Same API key used for REST API

**GraphQL Query:**
```graphql
query {
  plannedDispatches {
    startDt
    endDt
    delta
    meta {
      source
      location
    }
  }
}
```

**Implementation:**
```javascript
// lib/octopus-client.js

async getPlannedDispatches(dateFrom, dateTo) {
  const query = `
    query {
      plannedDispatches {
        startDt
        endDt
        delta
        meta {
          source
          location
        }
      }
    }
  `;

  const response = await axios.post(
    'https://api.octopus.energy/v1/graphql/',
    { query },
    {
      auth: {
        username: this.apiKey,
        password: ''
      },
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data.data.plannedDispatches;
}
```

### Phase 3: Match Consumption to Schedule

**Algorithm:**
```javascript
function matchSessionToSchedule(session, schedules) {
  const sessionStart = new Date(session.startTime);
  const sessionEnd = new Date(session.endTime);
  
  let scheduledEnergy = 0;
  let excessEnergy = 0;
  
  // Check each interval in the session
  for (const interval of session.intervals) {
    const intervalTime = new Date(interval.interval_start);
    
    // Find if this interval overlaps with any schedule
    const matchingSchedule = schedules.find(schedule => {
      const schedStart = new Date(schedule.startDt);
      const schedEnd = new Date(schedule.endDt);
      return intervalTime >= schedStart && intervalTime < schedEnd;
    });
    
    if (matchingSchedule) {
      scheduledEnergy += interval.consumption;
    } else {
      excessEnergy += interval.consumption;
    }
  }
  
  return {
    scheduledEnergy,
    excessEnergy,
    scheduledCost: scheduledEnergy * 0.075, // 7.5p/kWh
    excessCost: excessEnergy * 0.245,       // 24.5p/kWh
    totalCost: (scheduledEnergy * 0.075) + (excessEnergy * 0.245)
  };
}
```

### Phase 4: API Endpoints

**New endpoints:**

```javascript
// GET /api/schedules?from=YYYY-MM-DD&to=YYYY-MM-DD
// Fetch and return planned charging schedules

app.get('/api/schedules', async (req, res) => {
  const { from, to } = req.query;
  
  try {
    const schedules = await octopusClient.getPlannedDispatches(from, to);
    
    // Store in database
    for (const schedule of schedules) {
      await pool.query(
        `INSERT INTO charging_schedules (schedule_date, start_time, end_time, location, source)
         VALUES ($1, $2, $3, $4, 'octopus')
         ON CONFLICT DO NOTHING`,
        [
          schedule.startDt.split('T')[0],
          schedule.startDt,
          schedule.endDt,
          schedule.meta?.location
        ]
      );
    }
    
    res.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// POST /api/octopus/import-with-schedules
// Import sessions with schedule matching

app.post('/api/octopus/import-with-schedules', async (req, res) => {
  const { dateFrom, dateTo, threshold } = req.body;
  
  try {
    // 1. Fetch schedules for date range
    const schedules = await octopusClient.getPlannedDispatches(dateFrom, dateTo);
    
    // 2. Import sessions
    const sessions = await octopusClient.importSessions(dateFrom, dateTo, threshold);
    
    // 3. Match sessions to schedules
    const matchedSessions = sessions.map(session => {
      const match = matchSessionToSchedule(session, schedules);
      return {
        ...session,
        scheduledEnergy: match.scheduledEnergy,
        excessEnergy: match.excessEnergy,
        scheduledCost: match.scheduledCost,
        excessCost: match.excessCost,
        totalCost: match.totalCost
      };
    });
    
    // 4. Store in database with detailed breakdown
    // ...
    
    res.json(matchedSessions);
  } catch (error) {
    console.error('Error importing with schedules:', error);
    res.status(500).json({ error: 'Failed to import' });
  }
});
```

### Phase 5: UI Updates

**Display schedule info in session cards:**

```html
<div class="session-card">
  <div class="session-header">
    <span class="session-date">Wed, 14 Feb 2024</span>
    <span class="session-source">🐙 Octopus</span>
  </div>
  <div class="session-details">
    <div class="detail">
      <strong>Scheduled Energy:</strong> 42.5 kWh @ 7.5p = £3.19
    </div>
    <div class="detail excess" *ngIf="session.excessEnergy > 0">
      <strong>Excess Energy:</strong> 5.2 kWh @ 24.5p = £1.27
    </div>
    <div class="detail total">
      <strong>Total Cost:</strong> £4.46
    </div>
  </div>
</div>
```

**Add schedule sync button:**

```html
<div class="import-section">
  <button id="syncSchedulesButton">Sync Charging Schedules</button>
  <button id="importWithSchedulesButton">Import with Schedule Matching</button>
</div>
```

### Phase 6: Enhanced Statistics

**Dashboard stats with breakdown:**
```
Total Charging Sessions: 45
Total Energy: 850 kWh
  ├─ Scheduled: 820 kWh @ 7.5p = £61.50
  └─ Excess: 30 kWh @ 24.5p = £7.35
Total Cost: £68.85
Average Session Cost: £1.53
```

## Benefits

✅ **Most Accurate Costs**
- Precise breakdown of scheduled vs excess charging
- Real tariff rates for each type of usage

✅ **Behavior Insights**
- See when you're charging outside schedule
- Identify manual boost usage
- Optimize charging patterns

✅ **Budget Tracking**
- Accurate monthly costs
- Identify unexpected charges
- Better energy management

✅ **Schedule Verification**
- Confirm Octopus scheduled as expected
- Detect scheduling issues early
- Validate smart charging is working

## Implementation Priority

**Phase 1: Database Schema** - LOW EFFORT
- Add charging_schedules table
- Add columns to sessions table for breakdown

**Phase 2: Fetch Schedules** - MEDIUM EFFORT
- Implement GraphQL client
- Add schedule fetching endpoint
- Store schedules in database

**Phase 3: Matching Algorithm** - MEDIUM EFFORT
- Implement interval-level matching
- Calculate scheduled vs excess breakdown
- Update session storage

**Phase 4: UI Display** - LOW EFFORT
- Show schedule info in session cards
- Add sync button
- Display breakdown in statistics

**Phase 5: Testing** - MEDIUM EFFORT
- Test with real schedules
- Verify accuracy
- Handle edge cases

## Timeline Estimate

- **Phase 1:** 1-2 hours
- **Phase 2:** 3-4 hours
- **Phase 3:** 4-5 hours
- **Phase 4:** 2-3 hours
- **Phase 5:** 2-3 hours

**Total: 12-17 hours** for complete implementation

## Dependencies

**Required:**
- Octopus Energy API key (already have ✅)
- Access to GraphQL endpoint (same credentials ✅)
- PostgreSQL database (already have ✅)

**Optional:**
- User's vehicle details (for better schedule understanding)
- Multiple meter support (for future multi-car tracking)

## Testing Strategy

**Unit Tests:**
- Schedule fetching
- Matching algorithm
- Cost calculations

**Integration Tests:**
- End-to-end import with schedules
- Database storage
- API endpoints

**Manual Testing:**
- Import with real schedules
- Verify costs against Octopus bill
- Test edge cases (gaps, overlaps, etc.)

## Rollout Plan

**Phase 1: Beta Feature**
- Implement behind feature flag
- Test with small group of users
- Gather feedback

**Phase 2: Opt-in**
- Make available to all users
- Default OFF (use simple 7.5p logic)
- Users can enable if desired

**Phase 3: Default (Future)**
- After validation, make default
- Simple logic as fallback
- Allow manual override

## Alternative: Simpler Approach

If GraphQL is too complex, we can use a **hybrid approach:**

1. **Default:** All charging at 7.5p (current implementation) ✅
2. **User Override:** Allow manual marking of excess sessions
3. **UI Button:** "Mark as Excess (24.5p)" on each session
4. **Simple Logic:** User corrects cost if they know it was excess

This gives accuracy without API complexity.

## Conclusion

Schedule matching provides the **most accurate cost tracking** for Intelligent Octopus Go users. It's a valuable enhancement that helps users:
- Understand their charging costs precisely
- Identify excess usage patterns
- Validate smart charging is working correctly
- Budget more accurately

The current simple approach (all at 7.5p) works well for typical usage. Schedule matching is an **optional enhancement** for users who want maximum accuracy and insights.

## Next Steps

1. ✅ Deploy current simple fix (all at 7.5p)
2. Gather user feedback on accuracy
3. Decide if schedule matching is worth the complexity
4. Implement if users request more detailed tracking
5. Consider as part of "Pro" features in future

---

**Status:** PLANNED (Not yet implemented)
**Priority:** MEDIUM (Nice to have, not critical)
**Complexity:** MEDIUM-HIGH (GraphQL + matching logic)
**Value:** HIGH (Maximum accuracy for power users)

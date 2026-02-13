# Andersen A3 API Integration Setup Guide

## Overview

This guide explains how to integrate the Andersen A3 charger API with EvTracker to automatically import charging session data instead of manual logging.

## ⚠️ Important Notes

- **Current Status**: The Andersen API integration is not yet implemented in EvTracker
- **Current Method**: Manual session logging through the web interface
- **This Guide**: Provides information for future implementation

## Andersen A3 API Information

### What is the Andersen API?

The Andersen A3 charger may offer API access to retrieve charging session data programmatically. This would allow automatic synchronization of your charging sessions to EvTracker.

### API Capabilities (Typical Features)

Based on typical EV charger APIs, the Andersen API likely provides:
- **Charging session history**: Start/end times, energy delivered, cost
- **Charger status**: Current state, availability
- **Real-time data**: Active charging information
- **User management**: Access to your charger(s)

## Getting Started with Andersen API

### Step 1: Check API Availability

1. **Contact Andersen Support**
   - Email: support@andersen-ev.com (or check their website)
   - Website: https://www.andersen-ev.com/
   - Ask about API access for the A3 model

2. **Questions to Ask**
   - Is API access available for A3 charger owners?
   - What authentication method is used (API key, OAuth, etc.)?
   - What endpoints are available?
   - Are there rate limits?
   - Is there API documentation available?
   - Are webhooks supported for real-time updates?

### Step 2: Obtain API Credentials

If API access is available:

1. **Create an Andersen account** (if you don't have one)
   - Register your A3 charger
   - Verify your ownership

2. **Request API access**
   - This may require:
     - Developer application
     - API key generation
     - OAuth app registration

3. **Save your credentials**
   - API Key
   - Client ID/Secret (if using OAuth)
   - Charger ID or Serial Number

### Step 3: Configure EvTracker

Once you have API credentials, you would add them to your environment variables:

**Local Development (.env file):**
```env
# Existing variables
DATABASE_URL=your_neon_connection_string

# Andersen API credentials (add these)
ANDERSEN_API_KEY=your_api_key_here
ANDERSEN_CLIENT_ID=your_client_id_here
ANDERSEN_CLIENT_SECRET=your_client_secret_here
ANDERSEN_CHARGER_ID=your_charger_serial_or_id
```

**Vercel Deployment:**
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add each Andersen credential as a separate variable
3. Select all environments (Production, Preview, Development)
4. Redeploy

## API Integration Architecture

### How It Would Work

```
┌─────────────────┐
│  Andersen A3    │
│    Charger      │
└────────┬────────┘
         │
         │ Charging happens
         │
┌────────▼────────┐
│  Andersen Cloud │
│   API Service   │
└────────┬────────┘
         │
         │ API calls (polling or webhooks)
         │
┌────────▼────────┐
│   EvTracker     │
│   Server.js     │
└────────┬────────┘
         │
         │ Store sessions
         │
┌────────▼────────┐
│  Neon Postgres  │
│    Database     │
└─────────────────┘
```

### Implementation Options

#### Option A: Polling (Recommended for Start)
```javascript
// Pseudo-code for polling implementation
setInterval(async () => {
  const sessions = await andersenAPI.getRecentSessions();
  for (const session of sessions) {
    if (!existsInDatabase(session.id)) {
      await saveSession(transformSession(session));
    }
  }
}, 15 * 60 * 1000); // Poll every 15 minutes
```

#### Option B: Webhooks (If Supported)
```javascript
// Pseudo-code for webhook implementation
app.post('/api/webhooks/andersen', async (req, res) => {
  const session = req.body;
  if (verifyWebhookSignature(req)) {
    await saveSession(transformSession(session));
    res.status(200).send('OK');
  }
});
```

## Expected API Endpoints

Based on typical EV charger APIs, you might expect:

### Authentication
```
POST /oauth/token
Body: {
  client_id: "your_client_id",
  client_secret: "your_client_secret",
  grant_type: "client_credentials"
}
Response: {
  access_token: "...",
  expires_in: 3600
}
```

### Get Charging Sessions
```
GET /api/v1/chargers/{charger_id}/sessions
Headers: {
  Authorization: "Bearer {access_token}"
}
Query: {
  start_date: "2024-01-01",
  end_date: "2024-01-31"
}
Response: {
  sessions: [
    {
      id: "session_123",
      start_time: "2024-01-15T23:30:00Z",
      end_time: "2024-01-16T05:30:00Z",
      energy_kwh: 45.5,
      cost: 3.41,
      status: "completed"
    }
  ]
}
```

### Get Single Session
```
GET /api/v1/sessions/{session_id}
Headers: {
  Authorization: "Bearer {access_token}"
}
```

## Data Mapping

### Andersen Format → EvTracker Format

```javascript
function transformAndersenSession(andersenSession) {
  return {
    // Generate unique ID or use Andersen's ID
    id: `andersen-${andersenSession.id}`,
    
    // Extract date and times
    date: andersenSession.start_time.split('T')[0],
    startTime: extractTime(andersenSession.start_time),
    endTime: extractTime(andersenSession.end_time),
    
    // Energy and cost
    energyAdded: andersenSession.energy_kwh,
    cost: andersenSession.cost || calculateCost(andersenSession.energy_kwh),
    tariffRate: andersenSession.tariff_rate || 7.5,
    
    // Optional fields
    startSoC: andersenSession.start_soc || null,
    endSoC: andersenSession.end_soc || null,
    notes: `Imported from Andersen A3 (Session: ${andersenSession.id})`
  };
}
```

## Security Considerations

1. **Never commit credentials**
   - Use environment variables
   - Add `.env` to `.gitignore` (already done)

2. **Secure API calls**
   - Use HTTPS only
   - Validate webhook signatures
   - Store tokens securely

3. **Rate limiting**
   - Respect Andersen's API rate limits
   - Implement exponential backoff for retries
   - Cache data when possible

## Implementation Checklist

To implement Andersen API integration:

- [ ] Contact Andersen to verify API availability
- [ ] Obtain API credentials
- [ ] Add credentials to environment variables
- [ ] Create `lib/andersen-client.js` for API calls
- [ ] Implement authentication flow
- [ ] Create session polling service
- [ ] Add data transformation layer
- [ ] Handle duplicate detection
- [ ] Add error handling and logging
- [ ] Test with real charger data
- [ ] Update UI to show import status
- [ ] Add settings page for API configuration

## Alternative: OCPP Integration

If Andersen doesn't offer a REST API, the A3 charger supports OCPP (Open Charge Point Protocol):

### OCPP Overview
- Industry standard for charger communication
- Requires running an OCPP server
- More complex but more powerful
- Real-time updates

### OCPP Setup
1. Deploy an OCPP server (e.g., Steve, CitrineOS)
2. Configure A3 charger to connect to your OCPP server
3. Implement message handlers for charging events
4. Store session data in EvTracker database

**Note**: OCPP is significantly more complex and may not be necessary for basic session tracking.

## Current Workaround: Manual Import

Until API integration is implemented, you can:

1. **Export from Andersen App** (if available)
   - Check if Andersen app has export feature
   - Export to CSV or JSON

2. **Bulk Import Script** (future feature)
   - Create script to import CSV data
   - Map columns to EvTracker format
   - Import via API endpoints

## Need Help?

### Resources
- Andersen Support: Check their website for contact details
- EvTracker Issues: https://github.com/tomkerry47/EvTracker/issues
- OCPP Specification: https://www.openchargealliance.org/

### Contributing

If you successfully set up Andersen API integration:
1. Document your process
2. Share API documentation (if publicly available)
3. Contribute code via pull request
4. Help others in GitHub discussions

## FAQ

**Q: Is the Andersen API free?**
A: This varies by manufacturer. Check with Andersen support.

**Q: Can I use this with other chargers?**
A: The concepts are similar. You'd need to adapt the integration for your specific charger's API.

**Q: How often will sessions sync?**
A: Recommended: Every 15-30 minutes to avoid rate limits while keeping data reasonably current.

**Q: What if I charge at public chargers too?**
A: You can still manually add those sessions through the web interface.

**Q: Will automatic import overwrite my manual entries?**
A: No, if implemented correctly, it will check for duplicates and skip existing sessions.

## Status Updates

This integration is planned for a future release. Track progress:
- GitHub Issues: Tag `enhancement` and `andersen-integration`
- Pull Requests: Search for "Andersen" or "API integration"

---

**Last Updated**: 2026-02-13  
**Status**: Documentation only - Implementation pending

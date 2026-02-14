# Testing Guide

## Overview

This document describes how to test the EvTracker application locally and in production.

## Local Testing with Supabase

### Prerequisites
- Active Supabase project
- Environment variables configured in `.env`

### Running Tests

1. **Start the server:**
```bash
npm start
```

2. **Test API endpoints manually:**

```bash
# Get all sessions (should return empty array initially)
curl http://localhost:3000/api/sessions

# Get statistics
curl http://localhost:3000/api/stats

# Create a session
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-02-13",
    "startTime": "23:30",
    "endTime": "05:30",
    "energyAdded": 45.5,
    "startSoC": 20,
    "endSoC": 80,
    "tariffRate": 7.5,
    "cost": 3.41,
    "notes": "Test session"
  }'

# Get all sessions (should return the created session)
curl http://localhost:3000/api/sessions

# Get a specific session (replace ID with the one from previous response)
curl http://localhost:3000/api/sessions/YOUR-SESSION-ID

# Update a session
curl -X PUT http://localhost:3000/api/sessions/YOUR-SESSION-ID \
  -H "Content-Type: application/json" \
  -d '{"notes": "Updated notes"}'

# Delete a session
curl -X DELETE http://localhost:3000/api/sessions/YOUR-SESSION-ID
```

3. **Test the frontend:**
- Open http://localhost:3000 in your browser
- Try adding a session via the form
- Verify it appears in the list
- Check that statistics update correctly
- Test deleting a session

## Testing Without Supabase (Mock Testing)

If you want to test without a real Supabase instance, you can modify `server.js` temporarily to use a mock:

```javascript
// At the top of server.js, comment out Supabase initialization and add:
const mockData = [];

// Replace Supabase calls with mock operations:
app.get('/api/sessions', (req, res) => {
  res.json(mockData);
});

app.post('/api/sessions', (req, res) => {
  const id = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
  const newSession = { id, ...req.body, createdAt: new Date().toISOString() };
  mockData.push(newSession);
  res.status(201).json(newSession);
});
// ... etc
```

## Production Testing (Vercel)

After deploying to Vercel:

1. **Test the deployed URL:**
```bash
# Replace with your actual Vercel URL
VERCEL_URL="https://your-app.vercel.app"

curl $VERCEL_URL/api/sessions
curl $VERCEL_URL/api/stats
```

2. **Test through browser:**
- Visit your Vercel URL
- Add a session
- Verify it persists across page refreshes
- Test all CRUD operations

3. **Check Vercel logs:**
- Go to your project in Vercel Dashboard
- Click "Functions" tab
- View real-time logs for debugging

4. **Check Supabase logs:**
- Go to your Supabase project
- Click "Logs" in the sidebar
- View database queries and errors

## Automated Testing (Future Enhancement)

To add automated tests, create a `test/` directory with:

```javascript
// test/api.test.js
const request = require('supertest');
const app = require('../server');

describe('API Endpoints', () => {
  it('GET /api/sessions should return an array', async () => {
    const res = await request(app).get('/api/sessions');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/sessions should create a session', async () => {
    const sessionData = {
      date: '2024-02-13',
      startTime: '23:30',
      endTime: '05:30',
      energyAdded: 45.5,
      tariffRate: 7.5,
      cost: 3.41
    };
    const res = await request(app)
      .post('/api/sessions')
      .send(sessionData);
    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();
  });
});
```

Install test dependencies:
```bash
npm install --save-dev jest supertest
```

Add test script to `package.json`:
```json
"scripts": {
  "test": "jest"
}
```

## Performance Testing

Test database performance:

```sql
-- In Supabase SQL Editor
EXPLAIN ANALYZE 
SELECT * FROM charging_sessions 
ORDER BY created_at DESC 
LIMIT 100;
```

Check query performance and ensure indexes are being used.

## Security Testing

1. **Test RLS policies:**
   - Try accessing data without proper authentication
   - Verify users can only see their own data (if multi-user)

2. **Test input validation:**
   - Try submitting invalid data
   - Test SQL injection attempts (should be blocked by Supabase)
   - Test XSS attempts in notes field

3. **Check environment variables:**
   - Verify `.env` is not committed to Git
   - Ensure production secrets are not exposed

## Browser Compatibility Testing

Test in multiple browsers:
- Chrome/Edge (Chromium)
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome Android)

Test responsive design at different screen sizes:
- Desktop (1920x1080)
- Tablet (768x1024)
- Mobile (375x667)

## Load Testing (Optional)

For high-traffic scenarios:

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test API endpoint
ab -n 1000 -c 10 https://your-app.vercel.app/api/sessions
```

This tests 1000 requests with 10 concurrent connections.

## Monitoring

Set up monitoring for production:

1. **Vercel Analytics:**
   - Enable in project settings
   - Monitor page views and performance

2. **Supabase Monitoring:**
   - Check database size: Settings > Database
   - Monitor API usage: Settings > API
   - Set up email alerts for high usage

3. **Error Tracking:**
   - Consider adding Sentry or similar
   - Monitor browser console errors
   - Track failed API requests

## Checklist

Before deploying to production:

- [ ] All API endpoints tested manually
- [ ] Frontend form validation works
- [ ] Sessions persist correctly
- [ ] Statistics calculate correctly
- [ ] Delete functionality works
- [ ] Mobile responsive design verified
- [ ] Environment variables secured
- [ ] Supabase RLS policies configured
- [ ] Error handling tested
- [ ] Performance acceptable
- [ ] Backups configured in Supabase

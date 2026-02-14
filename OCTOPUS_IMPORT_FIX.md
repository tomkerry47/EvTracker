# Octopus Energy Import - Date/Time Fix

## Issue: Invalid Dates and Times

If you were seeing incorrect dates or times when importing sessions from Octopus Energy, this has now been fixed.

## What Was Wrong

The Octopus Energy API returns timestamps in ISO 8601 format with timezone information:
```
2024-01-01T23:30:00Z          (UTC)
2024-01-01T23:30:00+00:00     (UTC with explicit offset)
2024-01-01T00:30:00+01:00     (BST - British Summer Time)
```

### Previous Implementation Problems

1. **Date Extraction**: Used `toISOString().split('T')[0]` which could:
   - Extract the wrong date if timezone conversion shifted it
   - Example: 23:30 on Jan 1st in UTC might become Jan 2nd in some timezones

2. **Time Formatting**: Used `toTimeString()` which:
   - Converted to the server's local timezone (not the user's timezone)
   - Resulted in times that didn't match actual charging times
   - Example: 23:30 UK time might show as 18:30 if server was in US Eastern time

3. **Inconsistent Display**: 
   - Off-peak charging times (11:30 PM - 5:30 AM UK time) displayed incorrectly
   - Sessions appeared at wrong times of day

## What's Fixed

### New Implementation

The code now properly handles timezones using `Intl.DateTimeFormat`:

```javascript
// Extract date in UK timezone
const ukDateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

// Extract time in UK timezone  
const ukTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});
```

### Why UK Timezone?

- **Octopus Energy is UK-based**: All their tariffs and times are in UK timezone
- **Your meter runs on UK time**: Smart meters in the UK use UK timezone
- **Tariff times are UK times**: Intelligent Octopus Go off-peak (11:30 PM - 5:30 AM) is UK time
- **API data is UK-centric**: The consumption data reflects UK time periods

## Results After Fix

✅ **Dates are correct**: No more day shifts due to timezone conversion
✅ **Times match your meter**: Import shows actual charging times from your electricity meter
✅ **Off-peak times correct**: Sessions at 11:30 PM - 5:30 AM show correctly
✅ **Consistent display**: All times align with UK time regardless of server location

## Example

### Before Fix (Incorrect)
- API: `2024-01-01T23:30:00Z` (11:30 PM UK time on Jan 1st)
- Displayed: Date: `2024-01-01`, Time: `18:30` (if server was in US ET)
- **Wrong!** Shows 6:30 PM instead of 11:30 PM

### After Fix (Correct)  
- API: `2024-01-01T23:30:00Z` (11:30 PM UK time on Jan 1st)
- Displayed: Date: `2024-01-01`, Time: `23:30`
- **Correct!** Shows actual UK time when charging occurred

## What to Do Now

### If You Have Incorrect Sessions

1. **Delete incorrect sessions**: Use the delete button on sessions with wrong times
2. **Re-import**: After redeploying with this fix, import the same date range again
3. **Verify**: Check that times now match your actual charging times

### Testing the Fix

After Vercel redeploys (takes 2-3 minutes after this commit):

1. Go to your EvTracker app
2. Scroll to "Import from Octopus Energy" section
3. Select a date range when you know you charged
4. Click "Import Sessions"
5. Check the imported sessions:
   - ✅ Dates should be correct
   - ✅ Times should match when you actually charged
   - ✅ Off-peak sessions should show late night/early morning times

### Verifying Against Your Data

To confirm accuracy:
1. Check your Octopus Energy app or dashboard
2. Compare charging session times there with what's imported
3. They should now match!

## Technical Details

### Octopus API Response Format

The Octopus Energy API returns consumption data like this:
```json
{
  "consumption": 3.145,
  "interval_start": "2024-01-01T23:00:00Z",
  "interval_end": "2024-01-01T23:30:00Z"
}
```

- `interval_start` and `interval_end` are in ISO 8601 format
- Usually in UTC (`Z` suffix) or with timezone offset
- Represents 30-minute consumption intervals

### How Detection Works

1. **Fetch consumption data** for date range
2. **Detect charging sessions**: Intervals with >2 kWh consumption
3. **Group consecutive intervals** into sessions
4. **Extract start/end times** with proper timezone handling
5. **Store in database** with UK-formatted dates and times

### Database Storage

- **date**: DATE column (YYYY-MM-DD in UK timezone)
- **start_time**: TIME column (HH:MM in UK timezone)
- **end_time**: TIME column (HH:MM in UK timezone)

The timezone context is implicit (always UK time for Octopus data).

## Frequently Asked Questions

### Q: Why not store with timezone in database?

**A:** The DATE and TIME columns don't have timezone awareness. Since Octopus Energy is UK-only and all times are UK time, we consistently use UK timezone for storage. This keeps the schema simple while ensuring accuracy.

### Q: What if I'm not in the UK?

**A:** If you're accessing the app from outside the UK:
- Import will still work correctly
- Times will display in UK time (matching your meter and Octopus dashboard)
- This is correct behavior since your electricity meter and tariff operate on UK time

### Q: Can times cross midnight?

**A:** Yes! Many charging sessions run overnight:
- Start: `23:30` (Jan 1st)
- End: `05:30` (Jan 2nd)

The code handles this correctly. The date reflects when charging started.

### Q: What about British Summer Time (BST)?

**A:** The `Europe/London` timezone automatically handles:
- GMT (Greenwich Mean Time) in winter
- BST (British Summer Time) in summer
- Transitions between them

Your import will always show correct local UK time for any season.

## Related Documentation

- [Octopus API Setup](./OCTOPUS_API_SETUP.md) - Complete Octopus integration guide
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions
- [Setup Database](./SETUP_DATABASE.md) - Database schema and setup

## Need Help?

If times still don't look right after this fix:
1. Check which timezone your sessions should be in
2. Verify they match your Octopus Energy dashboard
3. Confirm your MPAN and meter serial are correct
4. Try deleting and re-importing a test date range

The fix ensures consistency with UK time, which is the correct reference for Octopus Energy data.

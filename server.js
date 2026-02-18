require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const OctopusEnergyClient = require('./lib/octopus-client');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize PostgreSQL connection pool
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('ERROR: Missing database connection string. Please set DATABASE_URL in your .env file.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  console.log('Connected to Neon Postgres database');
});

// Initialize Octopus Energy client if credentials are available
let octopusClient = null;
if (process.env.OCTOPUS_API_KEY && process.env.OCTOPUS_MPAN && process.env.OCTOPUS_SERIAL) {
  octopusClient = new OctopusEnergyClient(
    process.env.OCTOPUS_API_KEY,
    process.env.OCTOPUS_MPAN,
    process.env.OCTOPUS_SERIAL,
    {
      accountNumber: process.env.OCTOPUS_ACCOUNT_NUMBER || null,
      graphqlToken: process.env.OCTOPUS_GRAPHQL_TOKEN || null
    }
  );
  console.log('Octopus Energy API client initialized');
} else {
  console.log('Octopus Energy API credentials not found - import functionality disabled');
}

// Middleware
app.use(express.json());
app.use(express.static('public'));

function formatUkDate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function formatUkTime(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function toIsoDateOnly(value) {
  if (!value) return value;
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
}

function addDaysToIsoDate(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function getSessionWindowStrings(session) {
  const dateOnly = toIsoDateOnly(session.date);
  const start = `${dateOnly} ${session.startTime}:00`;
  const isOvernight = session.endTime <= session.startTime;
  const endDate = isOvernight ? addDaysToIsoDate(dateOnly, 1) : dateOnly;
  const end = `${endDate} ${session.endTime}:00`;
  return { start, end };
}

function normalizeBlock(block, tariffRate) {
  const charged = Math.abs(parseFloat(block?.charged_kwh ?? block?.charge_in_kwh ?? 0) || 0);
  const cost = Number.isFinite(parseFloat(block?.cost))
    ? parseFloat(block.cost)
    : parseFloat(((charged * tariffRate) / 100).toFixed(2));
  return {
    start: block.start,
    end: block.end,
    charge_in_kwh: Number(block.charge_in_kwh ?? -charged),
    charged_kwh: charged,
    cost,
    source: block.source || 'completed-dispatch'
  };
}

function mergeSessionBlocks(existingSession, incomingSession, tariffRate, gapMinutes) {
  const existingBlocks = Array.isArray(existingSession.dispatch_blocks)
    ? existingSession.dispatch_blocks
    : [];
  const incomingBlocks = Array.isArray(incomingSession.dispatchBlocks)
    ? incomingSession.dispatchBlocks
    : [];

  const allBlocks = [...existingBlocks, ...incomingBlocks]
    .map((block) => normalizeBlock(block, tariffRate))
    .filter((block) => block.start && block.end);

  // Deduplicate by time window.
  const dedupMap = new Map();
  for (const block of allBlocks) {
    dedupMap.set(`${block.start}|${block.end}`, block);
  }

  const uniqueBlocks = [...dedupMap.values()].sort((a, b) => new Date(a.start) - new Date(b.start));
  if (!uniqueBlocks.length) {
    return null;
  }

  // Collapse block groups using the same gap rule.
  const mergedGroups = [];
  for (const block of uniqueBlocks) {
    const current = mergedGroups[mergedGroups.length - 1];
    const start = new Date(block.start);
    const end = new Date(block.end);

    if (!current) {
      mergedGroups.push({ start, end, blocks: [block] });
      continue;
    }

    const gapMs = start - current.end;
    if (gapMs <= gapMinutes * 60 * 1000) {
      current.end = end > current.end ? end : current.end;
      current.blocks.push(block);
    } else {
      mergedGroups.push({ start, end, blocks: [block] });
    }
  }

  // Choose the group containing incoming session start/end if possible; otherwise largest energy group.
  const incomingStart = new Date(`${incomingSession.date}T${incomingSession.startTime}:00`);
  const incomingEnd = new Date(`${incomingSession.date}T${incomingSession.endTime}:00`);
  if (incomingEnd <= incomingStart) {
    incomingEnd.setDate(incomingEnd.getDate() + 1);
  }
  const targetGroup = mergedGroups.find((group) =>
    group.start <= incomingEnd && group.end >= incomingStart
  ) || mergedGroups.reduce((best, group) => {
    const groupKwh = group.blocks.reduce((sum, b) => sum + (parseFloat(b.charged_kwh) || 0), 0);
    const bestKwh = best ? best.blocks.reduce((sum, b) => sum + (parseFloat(b.charged_kwh) || 0), 0) : -1;
    return groupKwh > bestKwh ? group : best;
  }, null);

  if (!targetGroup) return null;

  const totalKwh = targetGroup.blocks.reduce((sum, block) => sum + (parseFloat(block.charged_kwh) || 0), 0);
  const totalCost = targetGroup.blocks.reduce((sum, block) => sum + (parseFloat(block.cost) || 0), 0);
  const startDate = targetGroup.start;
  const endDate = targetGroup.end;

  return {
    date: formatUkDate(startDate),
    startTime: formatUkTime(startDate),
    endTime: formatUkTime(endDate),
    energyAdded: parseFloat(totalKwh.toFixed(3)),
    cost: parseFloat(totalCost.toFixed(2)),
    dispatchCount: targetGroup.blocks.length,
    dispatchBlocks: targetGroup.blocks,
    octopusSessionId: `${startDate.toISOString()}_${endDate.toISOString()}_${targetGroup.blocks.length}`
  };
}

// API Routes

// Get all charging sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM charging_sessions ORDER BY created_at DESC'
    );
    
    console.log(`=== Fetching ${result.rows.length} sessions from database ===`);
    if (result.rows.length > 0) {
      const firstSession = result.rows[0];
      console.log('First session from DB:');
      console.log('  date:', firstSession.date, 'Type:', typeof firstSession.date);
      console.log('  start_time:', firstSession.start_time);
      console.log('  end_time:', firstSession.end_time);
    }
    
    // Transform data to match frontend expectations (camelCase)
    const sessions = result.rows.map(session => {
      // Convert Date object to YYYY-MM-DD string to avoid timezone issues
      const dateStr = session.date instanceof Date 
        ? session.date.toISOString().split('T')[0]
        : session.date;
      
      return {
        id: session.id,
        date: dateStr,
        startTime: session.start_time,
        endTime: session.end_time,
        energyAdded: parseFloat(session.energy_added),
        startSoC: session.start_soc,
        endSoC: session.end_soc,
        tariffRate: parseFloat(session.tariff_rate),
        cost: parseFloat(session.cost),
        notes: session.notes,
        source: session.source || 'manual',
        vehicle: session.vehicle || null,
        octopusSessionId: session.octopus_session_id,
        dispatchCount: session.dispatch_count || null,
        dispatchBlocks: session.dispatch_blocks || null,
        createdAt: session.created_at
      };
    });
    
    console.log('=== Transformed for frontend ===');
    if (sessions.length > 0) {
      console.log('First session sent to frontend:');
      console.log('  date:', sessions[0].date, 'Type:', typeof sessions[0].date);
      console.log('  startTime:', sessions[0].startTime);
    }
    console.log('=== End Transform ===');
    
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to read sessions' });
  }
});

// Get a specific session
app.get('/api/sessions/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM charging_sessions WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const data = result.rows[0];
    
    // Transform data to match frontend expectations (camelCase)
    const session = {
      id: data.id,
      date: data.date,
      startTime: data.start_time,
      endTime: data.end_time,
      energyAdded: parseFloat(data.energy_added),
      startSoC: data.start_soc,
      endSoC: data.end_soc,
      tariffRate: parseFloat(data.tariff_rate),
      cost: parseFloat(data.cost),
      notes: data.notes,
      source: data.source || 'manual',
      vehicle: data.vehicle || null,
      dispatchCount: data.dispatch_count || null,
      dispatchBlocks: data.dispatch_blocks || null,
      createdAt: data.created_at
    };
    
    res.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to read session' });
  }
});

// Create a new charging session
app.post('/api/sessions', async (req, res) => {
  try {
    // Generate unique ID using timestamp + random suffix to prevent collisions
    const id = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
    
    const result = await pool.query(
      `INSERT INTO charging_sessions 
        (id, date, start_time, end_time, energy_added, start_soc, end_soc, tariff_rate, cost, notes, source, vehicle, octopus_session_id, dispatch_count, dispatch_blocks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        id,
        req.body.date,
        req.body.startTime,
        req.body.endTime,
        req.body.energyAdded,
        req.body.startSoC || null,
        req.body.endSoC || null,
        req.body.tariffRate,
        req.body.cost,
        req.body.notes || null,
        req.body.source || 'manual',
        req.body.vehicle || null,
        req.body.octopusSessionId || null,
        req.body.dispatchCount || null,
        req.body.dispatchBlocks ? JSON.stringify(req.body.dispatchBlocks) : null
      ]
    );
    
    const data = result.rows[0];
    
    // Transform response back to camelCase
    const newSession = {
      id: data.id,
      date: data.date,
      startTime: data.start_time,
      endTime: data.end_time,
      energyAdded: parseFloat(data.energy_added),
      startSoC: data.start_soc,
      endSoC: data.end_soc,
      tariffRate: parseFloat(data.tariff_rate),
      cost: parseFloat(data.cost),
      notes: data.notes,
      source: data.source || 'manual',
      vehicle: data.vehicle || null,
      dispatchCount: data.dispatch_count || null,
      dispatchBlocks: data.dispatch_blocks || null,
      createdAt: data.created_at
    };
    
    res.status(201).json(newSession);
  } catch (error) {
    console.error('Error creating session:', error);
    // Handle unique constraint violation for duplicate octopus sessions
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Session already imported' });
    }
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Update a charging session
app.put('/api/sessions/:id', async (req, res) => {
  try {
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (req.body.date !== undefined) {
      updates.push(`date = $${paramCount++}`);
      values.push(req.body.date);
    }
    if (req.body.startTime !== undefined) {
      updates.push(`start_time = $${paramCount++}`);
      values.push(req.body.startTime);
    }
    if (req.body.endTime !== undefined) {
      updates.push(`end_time = $${paramCount++}`);
      values.push(req.body.endTime);
    }
    if (req.body.energyAdded !== undefined) {
      updates.push(`energy_added = $${paramCount++}`);
      values.push(req.body.energyAdded);
    }
    if (req.body.startSoC !== undefined) {
      updates.push(`start_soc = $${paramCount++}`);
      values.push(req.body.startSoC);
    }
    if (req.body.endSoC !== undefined) {
      updates.push(`end_soc = $${paramCount++}`);
      values.push(req.body.endSoC);
    }
    if (req.body.tariffRate !== undefined) {
      updates.push(`tariff_rate = $${paramCount++}`);
      values.push(req.body.tariffRate);
    }
    if (req.body.cost !== undefined) {
      updates.push(`cost = $${paramCount++}`);
      values.push(req.body.cost);
    }
    if (req.body.notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      values.push(req.body.notes);
    }
    if (req.body.vehicle !== undefined) {
      updates.push(`vehicle = $${paramCount++}`);
      values.push(req.body.vehicle);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(req.params.id);
    
    const result = await pool.query(
      `UPDATE charging_sessions 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const data = result.rows[0];
    
    // Transform response back to camelCase
    const session = {
      id: data.id,
      date: data.date,
      startTime: data.start_time,
      endTime: data.end_time,
      energyAdded: parseFloat(data.energy_added),
      startSoC: data.start_soc,
      endSoC: data.end_soc,
      tariffRate: parseFloat(data.tariff_rate),
      cost: parseFloat(data.cost),
      notes: data.notes,
      source: data.source || 'manual',
      vehicle: data.vehicle || null,
      dispatchCount: data.dispatch_count || null,
      dispatchBlocks: data.dispatch_blocks || null,
      createdAt: data.created_at
    };
    
    res.json(session);
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Delete a charging session
app.delete('/api/sessions/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM charging_sessions WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({ message: 'Session deleted' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Octopus Energy API Routes

// Import charging sessions from Octopus Energy API
app.post('/api/octopus/import', async (req, res) => {
  try {
    if (!octopusClient) {
      return res.status(503).json({ 
        error: 'Octopus Energy API not configured. Please set OCTOPUS_API_KEY, OCTOPUS_MPAN, and OCTOPUS_SERIAL environment variables.' 
      });
    }

    const { dateFrom, dateTo, tariffRate, autoDetectRate, mergeGapHours, accountNumber, vehicle } = req.body;
    
    // Validate inputs
    if (!dateFrom || !dateTo) {
      return res.status(400).json({ error: 'dateFrom and dateTo are required' });
    }

    console.log('=== Import Request ===');
    console.log('Date range:', dateFrom, 'to', dateTo);
    console.log('Merge gap:', mergeGapHours || 4, 'hours');
    console.log('Tariff rate:', tariffRate || 'auto-detect');
    console.log('Auto-detect rate:', autoDetectRate);

    // Import sessions from completedDispatches GraphQL.
    const effectiveTariffRate = autoDetectRate ? octopusClient.getIntelligentOctopusChargingRate() : (tariffRate || 7.0);
    const parsedGapHours = Number(mergeGapHours);
    const gapHours = Number.isFinite(parsedGapHours) && parsedGapHours >= 0 ? parsedGapHours : 4;
    const gapMinutes = gapHours * 60;
    const sessions = await octopusClient.importSessionsFromCompletedDispatches({
      dateFrom,
      dateTo,
      tariffRate: effectiveTariffRate,
      gapMinutes,
      accountNumber: accountNumber || undefined,
      vehicle: vehicle || null
    });

    // Insert sessions into database
    const importedSessions = [];
    let updated = 0;
    const skippedSessions = [];

    for (const session of sessions) {
      try {
        const { start: incomingStartTs, end: incomingEndTs } = getSessionWindowStrings(session);
        const existingResult = await pool.query(
          `SELECT * FROM charging_sessions
           WHERE source LIKE 'octopus%'
             AND (CAST(CAST(date AS date)::text || ' ' || start_time::text AS timestamp) <= $2::timestamp + ($3::text || ' minutes')::interval)
             AND (
               CASE
                 WHEN end_time < start_time THEN CAST(CAST(date AS date)::text || ' ' || end_time::text AS timestamp) + interval '1 day'
                 ELSE CAST(CAST(date AS date)::text || ' ' || end_time::text AS timestamp)
               END
             ) >= $1::timestamp - ($3::text || ' minutes')::interval
           ORDER BY date DESC, start_time DESC
          `,
          [incomingStartTs, incomingEndTs, gapMinutes]
        );

        if (existingResult.rows.length > 0) {
          let merged = { ...session };
          // Fold all overlapping candidates into one merged payload.
          for (const existing of existingResult.rows) {
            const nextMerged = mergeSessionBlocks(existing, merged, session.tariffRate, gapMinutes);
            if (nextMerged) {
              merged = {
                ...merged,
                ...nextMerged
              };
            }
          }

          if (merged) {
            const keepRow = existingResult.rows[0];
            const updateResult = await pool.query(
              `UPDATE charging_sessions
               SET date = $1,
                   start_time = $2,
                   end_time = $3,
                   energy_added = $4,
                   tariff_rate = $5,
                   cost = $6,
                   source = $7,
                   vehicle = $8,
                   octopus_session_id = $9,
                   dispatch_count = $10,
                   dispatch_blocks = $11
               WHERE id = $12
               RETURNING *`,
              [
                merged.date,
                merged.startTime,
                merged.endTime,
                merged.energyAdded,
                session.tariffRate,
                merged.cost,
                'octopus-graphql',
                keepRow.vehicle || session.vehicle || null,
                merged.octopusSessionId,
                merged.dispatchCount,
                JSON.stringify(merged.dispatchBlocks),
                keepRow.id
              ]
            );

            // Remove other overlapping rows that are now subsumed by the merged row.
            const extraIds = existingResult.rows
              .map((row) => row.id)
              .filter((id) => id !== keepRow.id);
            if (extraIds.length > 0) {
              await pool.query(
                `DELETE FROM charging_sessions WHERE id = ANY($1::text[])`,
                [extraIds]
              );
            }

            const data = updateResult.rows[0];
            importedSessions.push({
              id: data.id,
              date: data.date,
              startTime: data.start_time,
              endTime: data.end_time,
              energyAdded: parseFloat(data.energy_added),
              startSoC: data.start_soc,
              endSoC: data.end_soc,
              tariffRate: parseFloat(data.tariff_rate),
              cost: parseFloat(data.cost),
              notes: data.notes,
              source: data.source,
              vehicle: data.vehicle || null,
              dispatchCount: data.dispatch_count || null,
              dispatchBlocks: data.dispatch_blocks || null,
              createdAt: data.created_at
            });
            updated++;
            continue;
          }
        }

        const id = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
        
        console.log('=== Inserting Session to Database ===');
        console.log('Session date:', session.date, 'Type:', typeof session.date);
        console.log('Session startTime:', session.startTime, 'Type:', typeof session.startTime);
        console.log('Session endTime:', session.endTime, 'Type:', typeof session.endTime);
        console.log('Session energy:', session.energyAdded, 'kWh');
        console.log('Session cost:', session.cost);
        
        const result = await pool.query(
          `INSERT INTO charging_sessions 
            (id, date, start_time, end_time, energy_added, start_soc, end_soc, tariff_rate, cost, notes, source, vehicle, octopus_session_id, dispatch_count, dispatch_blocks)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING *`,
          [
            id,
            session.date,
            session.startTime,
            session.endTime,
            session.energyAdded,
            session.startSoC,
            session.endSoC,
            session.tariffRate,
            session.cost,
            session.notes,
            session.source,
            session.vehicle || null,
            session.octopusSessionId,
            session.dispatchCount || null,
            session.dispatchBlocks ? JSON.stringify(session.dispatchBlocks) : null
          ]
        );

        const data = result.rows[0];
        console.log('Successfully inserted! Returned date from DB:', data.date);
        console.log('=== End Insert ===');
        importedSessions.push({
          id: data.id,
          date: data.date,
          startTime: data.start_time,
          endTime: data.end_time,
          energyAdded: parseFloat(data.energy_added),
          startSoC: data.start_soc,
          endSoC: data.end_soc,
          tariffRate: parseFloat(data.tariff_rate),
          cost: parseFloat(data.cost),
          notes: data.notes,
          source: data.source,
          vehicle: data.vehicle || null,
          dispatchCount: data.dispatch_count || null,
          dispatchBlocks: data.dispatch_blocks || null,
          createdAt: data.created_at
        });
      } catch (error) {
        // Handle duplicate sessions
        if (error.code === '23505') {
          skippedSessions.push(session);
        } else {
          throw error;
        }
      }
    }

    res.json({
      success: true,
      mode: 'completed-dispatches-graphql',
      detected: sessions.length,
      imported: importedSessions.length,
      updated,
      skipped: skippedSessions.length,
      sessions: importedSessions
    });
    
    // Store last import info in database (always, even if no new sessions)
    try {
      await pool.query(
        `INSERT INTO app_settings (key, value) 
         VALUES ('last_import', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify({ 
          timestamp: new Date().toISOString(), 
          count: importedSessions.length,
          updated: updated,
          total_detected: sessions.length,
          skipped: skippedSessions.length
        })]
      );
    } catch (error) {
      console.error('Error storing last import info:', error);
    }
  } catch (error) {
    console.error('Error importing sessions from Octopus:', error);
    res.status(500).json({ error: error.message || 'Failed to import sessions from Octopus Energy API' });
  }
});

// Get dispatch-like charging intervals from Octopus consumption for testing/preview
app.get('/api/octopus/dispatch-candidates', async (req, res) => {
  try {
    if (!octopusClient) {
      return res.status(503).json({
        error: 'Octopus Energy API not configured. Please set OCTOPUS_API_KEY, OCTOPUS_MPAN, and OCTOPUS_SERIAL environment variables.'
      });
    }

    const { dateFrom, dateTo, threshold } = req.query;
    const parsedThreshold = parseFloat(threshold || '2.0');

    if (!dateFrom || !dateTo) {
      return res.status(400).json({ error: 'dateFrom and dateTo are required (YYYY-MM-DD).' });
    }

    if (Number.isNaN(parsedThreshold) || parsedThreshold < 0) {
      return res.status(400).json({ error: 'threshold must be a number greater than or equal to 0.' });
    }

    const dispatches = await octopusClient.getDispatchCandidates(dateFrom, dateTo, parsedThreshold);

    res.json({
      count: dispatches.length,
      dateFrom,
      dateTo,
      threshold: parsedThreshold,
      dispatches
    });
  } catch (error) {
    console.error('Error fetching dispatch candidates from Octopus:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch Octopus dispatch candidates' });
  }
});

// Get completed Intelligent dispatches from Octopus GraphQL
app.get('/api/octopus/completed-dispatches', async (req, res) => {
  try {
    if (!octopusClient) {
      return res.status(503).json({
        error: 'Octopus Energy API not configured. Please set OCTOPUS_API_KEY, OCTOPUS_MPAN, and OCTOPUS_SERIAL environment variables.'
      });
    }

    const { accountNumber, dateFrom, dateTo } = req.query;
    let dispatches;
    try {
      dispatches = await octopusClient.getCompletedDispatches({
        accountNumber: accountNumber || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      });
    } catch (initialError) {
      // If no token has been configured, try authenticating via API key once.
      if (String(initialError.message || '').includes('Missing GraphQL token')) {
        const tokenResult = await octopusClient.obtainKrakenToken();
        octopusClient.graphqlToken = tokenResult.token;
        dispatches = await octopusClient.getCompletedDispatches({
          accountNumber: accountNumber || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined
        });
      } else {
        throw initialError;
      }
    }

    res.json({
      count: dispatches.length,
      source: 'octopus-graphql-completed-dispatches',
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      dispatches
    });
  } catch (error) {
    console.error('Error fetching completed dispatches from Octopus GraphQL:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch completed dispatches' });
  }
});

// Authenticate to Octopus GraphQL using API key and cache token in-memory
app.post('/api/octopus/graphql/auth', async (req, res) => {
  try {
    if (!octopusClient) {
      return res.status(503).json({
        error: 'Octopus Energy API not configured. Please set OCTOPUS_API_KEY, OCTOPUS_MPAN, and OCTOPUS_SERIAL environment variables.'
      });
    }

    const result = await octopusClient.obtainKrakenToken();
    octopusClient.graphqlToken = result.token;

    const tokenPreview = `${result.token.slice(0, 10)}...${result.token.slice(-6)}`;
    res.json({
      success: true,
      tokenPreview,
      refreshExpiresIn: result.refreshExpiresIn || null
    });
  } catch (error) {
    console.error('Error authenticating with Octopus GraphQL:', error);
    res.status(500).json({ error: error.message || 'Failed to authenticate with Octopus GraphQL' });
  }
});

// Check if Octopus API is configured
app.get('/api/octopus/status', (req, res) => {
  res.json({
    configured: octopusClient !== null,
    apiKey: process.env.OCTOPUS_API_KEY ? '✓ Set' : '✗ Not set',
    mpan: process.env.OCTOPUS_MPAN ? '✓ Set' : '✗ Not set',
    serial: process.env.OCTOPUS_SERIAL ? '✓ Set' : '✗ Not set',
    accountNumber: process.env.OCTOPUS_ACCOUNT_NUMBER ? '✓ Set' : '✗ Not set',
    graphqlToken: process.env.OCTOPUS_GRAPHQL_TOKEN ? '✓ Set' : '✗ Not set',
    graphqlTokenInMemory: octopusClient?.graphqlToken ? '✓ Set' : '✗ Not set'
  });
});

// Get app setting
app.get('/api/settings/:key', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT value, updated_at FROM app_settings WHERE key = $1',
      [req.params.key]
    );
    
    if (result.rows.length === 0) {
      return res.json({ value: null });
    }
    
    res.json({
      value: JSON.parse(result.rows[0].value),
      updated_at: result.rows[0].updated_at
    });
  } catch (error) {
    console.error('Error getting setting:', error);
    res.status(500).json({ error: 'Failed to get setting' });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT energy_added, cost FROM charging_sessions'
    );
    
    const data = result.rows;
    
    const stats = {
      totalSessions: data.length,
      totalEnergy: data.reduce((sum, s) => sum + (parseFloat(s.energy_added) || 0), 0),
      totalCost: data.reduce((sum, s) => sum + (parseFloat(s.cost) || 0), 0),
      averageEnergy: data.length > 0 
        ? data.reduce((sum, s) => sum + (parseFloat(s.energy_added) || 0), 0) / data.length 
        : 0
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error calculating stats:', error);
    res.status(500).json({ error: 'Failed to calculate stats' });
  }
});

app.listen(PORT, () => {
  console.log(`EvTracker server running on http://localhost:${PORT}`);
  console.log(`Connected to Neon Postgres database`);
});

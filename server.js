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
    process.env.OCTOPUS_SERIAL
  );
  console.log('Octopus Energy API client initialized');
} else {
  console.log('Octopus Energy API credentials not found - import functionality disabled');
}

// Middleware
app.use(express.json());
app.use(express.static('public'));

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
        octopusSessionId: session.octopus_session_id,
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
        (id, date, start_time, end_time, energy_added, start_soc, end_soc, tariff_rate, cost, notes, source, octopus_session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
        req.body.octopusSessionId || null
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

    const { dateFrom, dateTo, threshold, tariffRate, autoDetectRate } = req.body;
    
    // Validate inputs
    if (!dateFrom || !dateTo) {
      return res.status(400).json({ error: 'dateFrom and dateTo are required' });
    }

    console.log('=== Import Request ===');
    console.log('Date range:', dateFrom, 'to', dateTo);
    console.log('Threshold:', threshold || 2.0, 'kWh');
    console.log('Tariff rate:', tariffRate || 'auto-detect');
    console.log('Auto-detect rate:', autoDetectRate);

    // Import sessions from Octopus
    // Pass null for tariffRate if auto-detection is enabled
    const effectiveTariffRate = autoDetectRate ? null : (tariffRate || 7.5);
    const sessions = await octopusClient.importSessions(
      dateFrom, 
      dateTo, 
      threshold || 2.0, 
      effectiveTariffRate
    );

    // Insert sessions into database
    const importedSessions = [];
    const skippedSessions = [];

    for (const session of sessions) {
      try {
        const id = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
        
        console.log('=== Inserting Session to Database ===');
        console.log('Session date:', session.date, 'Type:', typeof session.date);
        console.log('Session startTime:', session.startTime, 'Type:', typeof session.startTime);
        console.log('Session endTime:', session.endTime, 'Type:', typeof session.endTime);
        console.log('Session energy:', session.energyAdded, 'kWh');
        console.log('Session cost:', session.cost);
        
        const result = await pool.query(
          `INSERT INTO charging_sessions 
            (id, date, start_time, end_time, energy_added, start_soc, end_soc, tariff_rate, cost, notes, source, octopus_session_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
            session.octopusSessionId
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
      imported: importedSessions.length,
      skipped: skippedSessions.length,
      sessions: importedSessions
    });
  } catch (error) {
    console.error('Error importing sessions from Octopus:', error);
    res.status(500).json({ error: error.message || 'Failed to import sessions from Octopus Energy API' });
  }
});

// Check if Octopus API is configured
app.get('/api/octopus/status', (req, res) => {
  res.json({
    configured: octopusClient !== null,
    apiKey: process.env.OCTOPUS_API_KEY ? '✓ Set' : '✗ Not set',
    mpan: process.env.OCTOPUS_MPAN ? '✓ Set' : '✗ Not set',
    serial: process.env.OCTOPUS_SERIAL ? '✓ Set' : '✗ Not set'
  });
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

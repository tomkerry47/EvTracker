require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

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
    
    // Transform data to match frontend expectations (camelCase)
    const sessions = result.rows.map(session => ({
      id: session.id,
      date: session.date,
      startTime: session.start_time,
      endTime: session.end_time,
      energyAdded: parseFloat(session.energy_added),
      startSoC: session.start_soc,
      endSoC: session.end_soc,
      tariffRate: parseFloat(session.tariff_rate),
      cost: parseFloat(session.cost),
      notes: session.notes,
      createdAt: session.created_at
    }));
    
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
        (id, date, start_time, end_time, energy_added, start_soc, end_soc, tariff_rate, cost, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
        req.body.notes || null
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
      createdAt: data.created_at
    };
    
    res.status(201).json(newSession);
  } catch (error) {
    console.error('Error creating session:', error);
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

require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// API Routes

// Get all charging sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('charging_sessions')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Transform data to match frontend expectations (camelCase)
    const sessions = data.map(session => ({
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
    const { data, error } = await supabase
      .from('charging_sessions')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Session not found' });
      }
      throw error;
    }
    
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
    
    // Transform camelCase to snake_case for database
    const sessionData = {
      id,
      date: req.body.date,
      start_time: req.body.startTime,
      end_time: req.body.endTime,
      energy_added: req.body.energyAdded,
      start_soc: req.body.startSoC || null,
      end_soc: req.body.endSoC || null,
      tariff_rate: req.body.tariffRate,
      cost: req.body.cost,
      notes: req.body.notes || null
    };
    
    const { data, error } = await supabase
      .from('charging_sessions')
      .insert([sessionData])
      .select()
      .single();
    
    if (error) throw error;
    
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
    // Transform camelCase to snake_case for database
    const updateData = {};
    if (req.body.date !== undefined) updateData.date = req.body.date;
    if (req.body.startTime !== undefined) updateData.start_time = req.body.startTime;
    if (req.body.endTime !== undefined) updateData.end_time = req.body.endTime;
    if (req.body.energyAdded !== undefined) updateData.energy_added = req.body.energyAdded;
    if (req.body.startSoC !== undefined) updateData.start_soc = req.body.startSoC;
    if (req.body.endSoC !== undefined) updateData.end_soc = req.body.endSoC;
    if (req.body.tariffRate !== undefined) updateData.tariff_rate = req.body.tariffRate;
    if (req.body.cost !== undefined) updateData.cost = req.body.cost;
    if (req.body.notes !== undefined) updateData.notes = req.body.notes;
    
    const { data, error } = await supabase
      .from('charging_sessions')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Session not found' });
      }
      throw error;
    }
    
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
    const { data, error } = await supabase
      .from('charging_sessions')
      .delete()
      .eq('id', req.params.id)
      .select();
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
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
    const { data, error } = await supabase
      .from('charging_sessions')
      .select('energy_added, cost');
    
    if (error) throw error;
    
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
  console.log(`Connected to Supabase at ${supabaseUrl}`);
});

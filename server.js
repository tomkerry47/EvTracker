const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Data file path
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'sessions.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// Helper functions
function readSessions() {
  const data = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(data);
}

function writeSessions(sessions) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(sessions, null, 2));
}

// API Routes

// Get all charging sessions
app.get('/api/sessions', (req, res) => {
  try {
    const sessions = readSessions();
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read sessions' });
  }
});

// Get a specific session
app.get('/api/sessions/:id', (req, res) => {
  try {
    const sessions = readSessions();
    const session = sessions.find(s => s.id === req.params.id);
    if (session) {
      res.json(session);
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to read session' });
  }
});

// Create a new charging session
app.post('/api/sessions', (req, res) => {
  try {
    const sessions = readSessions();
    // Generate unique ID using timestamp + random suffix to prevent collisions
    const id = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
    const newSession = {
      id,
      ...req.body,
      createdAt: new Date().toISOString()
    };
    sessions.push(newSession);
    writeSessions(sessions);
    res.status(201).json(newSession);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Update a charging session
app.put('/api/sessions/:id', (req, res) => {
  try {
    const sessions = readSessions();
    const index = sessions.findIndex(s => s.id === req.params.id);
    if (index !== -1) {
      sessions[index] = { ...sessions[index], ...req.body };
      writeSessions(sessions);
      res.json(sessions[index]);
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Delete a charging session
app.delete('/api/sessions/:id', (req, res) => {
  try {
    const sessions = readSessions();
    const filteredSessions = sessions.filter(s => s.id !== req.params.id);
    if (filteredSessions.length < sessions.length) {
      writeSessions(filteredSessions);
      res.json({ message: 'Session deleted' });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Get statistics
app.get('/api/stats', (req, res) => {
  try {
    const sessions = readSessions();
    const stats = {
      totalSessions: sessions.length,
      totalEnergy: sessions.reduce((sum, s) => sum + (s.energyAdded || 0), 0),
      totalCost: sessions.reduce((sum, s) => sum + (s.cost || 0), 0),
      averageEnergy: sessions.length > 0 
        ? sessions.reduce((sum, s) => sum + (s.energyAdded || 0), 0) / sessions.length 
        : 0
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate stats' });
  }
});

app.listen(PORT, () => {
  console.log(`EvTracker server running on http://localhost:${PORT}`);
});

// API Base URL
const API_URL = '/api';

// Load sessions on page load
document.addEventListener('DOMContentLoaded', () => {
    loadSessions();
    loadStats();
    setupForm();
    setDefaultDate();
    setupCostCalculation();
});

// Set default date to today
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
}

// Setup automatic cost calculation
function setupCostCalculation() {
    const energyInput = document.getElementById('energyAdded');
    const tariffInput = document.getElementById('tariffRate');
    const costInput = document.getElementById('cost');
    
    function calculateCost() {
        const energy = parseFloat(energyInput.value) || 0;
        const tariff = parseFloat(tariffInput.value) || 0;
        const cost = (energy * tariff / 100).toFixed(2);
        costInput.value = cost;
    }
    
    energyInput.addEventListener('input', calculateCost);
    tariffInput.addEventListener('input', calculateCost);
}

// Setup form submission
function setupForm() {
    const form = document.getElementById('sessionForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addSession();
    });
}

// Load and display all sessions
async function loadSessions() {
    try {
        const response = await fetch(`${API_URL}/sessions`);
        const sessions = await response.json();
        displaySessions(sessions);
    } catch (error) {
        console.error('Error loading sessions:', error);
        alert('Failed to load charging sessions');
    }
}

// Load and display statistics
async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/stats`);
        const stats = await response.json();
        
        document.getElementById('totalSessions').textContent = stats.totalSessions;
        document.getElementById('totalEnergy').textContent = `${stats.totalEnergy.toFixed(1)} kWh`;
        document.getElementById('totalCost').textContent = `£${stats.totalCost.toFixed(2)}`;
        document.getElementById('avgEnergy').textContent = `${stats.averageEnergy.toFixed(1)} kWh`;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Display sessions in the UI
function displaySessions(sessions) {
    const container = document.getElementById('sessionsContainer');
    
    if (sessions.length === 0) {
        container.innerHTML = '<p class="no-sessions">No charging sessions recorded yet. Add your first session above!</p>';
        return;
    }
    
    // Sort sessions by date (newest first)
    sessions.sort((a, b) => new Date(b.date + ' ' + b.startTime) - new Date(a.date + ' ' + a.startTime));
    
    container.innerHTML = sessions.map(session => createSessionCard(session)).join('');
    
    // Add delete event listeners
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (confirm('Are you sure you want to delete this session?')) {
                await deleteSession(id);
            }
        });
    });
}

// Create HTML for a session card
function createSessionCard(session) {
    const duration = calculateDuration(session.startTime, session.endTime);
    const socChange = session.startSoC && session.endSoC 
        ? `${session.startSoC}% → ${session.endSoC}%` 
        : 'N/A';
    
    return `
        <div class="session-card">
            <div class="session-header">
                <div class="session-date">
                    ${formatDate(session.date)} 
                    <span style="color: #888; font-size: 0.8em;">${session.startTime} - ${session.endTime}</span>
                </div>
                <button class="btn btn-danger delete-btn" data-id="${session.id}">Delete</button>
            </div>
            <div class="session-details">
                <div class="detail-item">
                    <span class="detail-label">Energy Added</span>
                    <span class="detail-value">${session.energyAdded} kWh</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Duration</span>
                    <span class="detail-value">${duration}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">SoC Change</span>
                    <span class="detail-value">${socChange}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Tariff Rate</span>
                    <span class="detail-value">${session.tariffRate}p/kWh</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Cost</span>
                    <span class="detail-value">£${parseFloat(session.cost).toFixed(2)}</span>
                </div>
            </div>
            ${session.notes ? `<div class="session-notes">${session.notes}</div>` : ''}
        </div>
    `;
}

// Add a new session
async function addSession() {
    const sessionData = {
        date: document.getElementById('date').value,
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        energyAdded: parseFloat(document.getElementById('energyAdded').value),
        startSoC: parseInt(document.getElementById('startSoC').value) || null,
        endSoC: parseInt(document.getElementById('endSoC').value) || null,
        tariffRate: parseFloat(document.getElementById('tariffRate').value),
        cost: parseFloat(document.getElementById('cost').value),
        notes: document.getElementById('notes').value
    };
    
    try {
        const response = await fetch(`${API_URL}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionData)
        });
        
        if (response.ok) {
            document.getElementById('sessionForm').reset();
            setDefaultDate();
            document.getElementById('tariffRate').value = '7.5';
            await loadSessions();
            await loadStats();
        } else {
            throw new Error('Failed to add session');
        }
    } catch (error) {
        console.error('Error adding session:', error);
        alert('Failed to add charging session');
    }
}

// Delete a session
async function deleteSession(id) {
    try {
        const response = await fetch(`${API_URL}/sessions/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadSessions();
            await loadStats();
        } else {
            throw new Error('Failed to delete session');
        }
    } catch (error) {
        console.error('Error deleting session:', error);
        alert('Failed to delete charging session');
    }
}

// Helper: Calculate duration between times
function calculateDuration(startTime, endTime) {
    const start = new Date(`2000-01-01 ${startTime}`);
    const end = new Date(`2000-01-01 ${endTime}`);
    let diff = (end - start) / 1000 / 60; // minutes
    
    // Handle overnight charging
    if (diff < 0) {
        diff += 24 * 60;
    }
    
    const hours = Math.floor(diff / 60);
    const minutes = Math.round(diff % 60);
    
    return `${hours}h ${minutes}m`;
}

// Helper: Format date nicely
function formatDate(dateString) {
    // Parse date in local timezone to avoid timezone shift issues
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-GB', options);
}

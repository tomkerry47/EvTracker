// API Base URL
const API_URL = '/api';

// Load sessions on page load
document.addEventListener('DOMContentLoaded', () => {
    loadSessions();
    loadStats();
    setupForm();
    setDefaultDate();
    setupCostCalculation();
    setupImportForm();
    setupManualEntryToggle();
    setupAutoDetectRateToggle();
});

// Set default date to today
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    
    // Set default import dates (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    document.getElementById('importDateFrom').value = sevenDaysAgo.toISOString().split('T')[0];
    document.getElementById('importDateTo').value = today;
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
        
        console.log('=== Frontend Received Sessions ===');
        console.log('Total sessions:', sessions.length);
        if (sessions.length > 0) {
            console.log('First session:');
            console.log('  date:', sessions[0].date, 'Type:', typeof sessions[0].date);
            console.log('  startTime:', sessions[0].startTime);
            console.log('  endTime:', sessions[0].endTime);
            console.log('  source:', sessions[0].source);
        }
        console.log('=== End Frontend Receive ===');
        
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
    
    const source = session.source || 'manual';
    const sourceBadge = `<span class="session-source ${source}">${source === 'octopus' ? '🐙 Octopus' : '👤 Manual'}</span>`;
    
    return `
        <div class="session-card">
            <div class="session-header">
                <div class="session-date">
                    ${formatDate(session.date)} 
                    <span style="color: #888; font-size: 0.8em;">${session.startTime} - ${session.endTime}</span>
                    ${sourceBadge}
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
        startSoC: null,  // Not used in simplified form
        endSoC: null,    // Not used in simplified form
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
            // Hide the form after successful add
            document.getElementById('manualEntryForm').style.display = 'none';
            document.getElementById('toggleManualEntry').textContent = '➕ Add Manual Entry';
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
    console.log('formatDate input:', dateString, 'Type:', typeof dateString);
    
    // Parse date in local timezone to avoid timezone shift issues
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    const formatted = date.toLocaleDateString('en-GB', options);
    
    console.log('formatDate output:', formatted);
    return formatted;
}

// Setup manual entry toggle
function setupManualEntryToggle() {
    const toggleButton = document.getElementById('toggleManualEntry');
    const manualForm = document.getElementById('manualEntryForm');
    const cancelButton = document.getElementById('cancelManualEntry');
    
    toggleButton.addEventListener('click', () => {
        if (manualForm.style.display === 'none') {
            manualForm.style.display = 'block';
            toggleButton.textContent = '➖ Hide Manual Entry';
            // Re-set default dates when showing the form
            setDefaultDate();
            manualForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            manualForm.style.display = 'none';
            toggleButton.textContent = '➕ Add Manual Entry';
        }
    });
    
    cancelButton.addEventListener('click', () => {
        manualForm.style.display = 'none';
        toggleButton.textContent = '➕ Add Manual Entry';
        document.getElementById('sessionForm').reset();
        setDefaultDate();
        document.getElementById('tariffRate').value = '7.5';
    });
}

// Setup auto-detect rate toggle
function setupAutoDetectRateToggle() {
    const autoDetectCheckbox = document.getElementById('autoDetectRate');
    const manualRateGroup = document.getElementById('manualRateGroup');
    
    autoDetectCheckbox.addEventListener('change', () => {
        if (autoDetectCheckbox.checked) {
            manualRateGroup.style.display = 'none';
        } else {
            manualRateGroup.style.display = 'block';
        }
    });
}

// Setup import form
function setupImportForm() {
    const importButton = document.getElementById('importButton');
    importButton.addEventListener('click', importFromOctopus);
}

// Import sessions from Octopus Energy
async function importFromOctopus() {
    const dateFrom = document.getElementById('importDateFrom').value;
    const dateTo = document.getElementById('importDateTo').value;
    const threshold = parseFloat(document.getElementById('importThreshold').value);
    const autoDetectRate = document.getElementById('autoDetectRate').checked;
    const tariffRate = autoDetectRate ? null : parseFloat(document.getElementById('importTariffRate').value);
    const statusDiv = document.getElementById('importStatus');
    const importButton = document.getElementById('importButton');
    
    if (!dateFrom || !dateTo) {
        showImportStatus('Please select both from and to dates', 'error');
        return;
    }
    
    // Disable button and show loading
    importButton.disabled = true;
    importButton.textContent = 'Importing...';
    const rateMsg = autoDetectRate ? 'auto-detecting rates' : `using ${tariffRate}p/kWh`;
    showImportStatus(`Fetching data from Octopus Energy API (${rateMsg})...`, 'info');
    
    try {
        const response = await fetch(`${API_URL}/octopus/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                dateFrom, 
                dateTo, 
                threshold, 
                tariffRate, 
                autoDetectRate 
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const message = `Successfully imported ${data.imported} session(s)${data.skipped > 0 ? ` (${data.skipped} duplicate(s) skipped)` : ''}`;
            showImportStatus(message, 'success');
            
            // Reload sessions and stats
            await loadSessions();
            await loadStats();
        } else {
            throw new Error(data.error || 'Import failed');
        }
    } catch (error) {
        console.error('Error importing from Octopus:', error);
        showImportStatus(`Import failed: ${error.message}`, 'error');
    } finally {
        // Re-enable button
        importButton.disabled = false;
        importButton.textContent = 'Import Sessions';
    }
}

// Show import status message
function showImportStatus(message, type) {
    const statusDiv = document.getElementById('importStatus');
    statusDiv.textContent = message;
    statusDiv.className = `import-status ${type}`;
    statusDiv.style.display = 'block';
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

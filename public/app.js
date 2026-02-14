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
    setupModals();
    setupAutoDetectRateToggle();
    setupFilterButtons();
    displayLastImportInfo();
});

// Setup filter buttons
function setupFilterButtons() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            loadSessions(filter);
            loadStats(filter);
        });
    });
}

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

// Global filter state
let currentFilter = 'all';

// Load and display all sessions
async function loadSessions(filter = currentFilter) {
    currentFilter = filter;
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
        
        // Filter sessions based on current filter
        const filteredSessions = filterSessionsByDate(sessions, filter);
        displaySessions(filteredSessions);
        updateFilterButtons(filter);
    } catch (error) {
        console.error('Error loading sessions:', error);
        alert('Failed to load charging sessions');
    }
}

// Load and display statistics
async function loadStats(filter = currentFilter) {
    try {
        const response = await fetch(`${API_URL}/stats`);
        const allStats = await response.json();
        
        // If filter is applied, calculate filtered stats
        if (filter !== 'all') {
            const sessionsResponse = await fetch(`${API_URL}/sessions`);
            const allSessions = await sessionsResponse.json();
            const filteredSessions = filterSessionsByDate(allSessions, filter);
            
            // Calculate filtered stats
            const totalSessions = filteredSessions.length;
            const totalEnergy = filteredSessions.reduce((sum, s) => sum + parseFloat(s.energyAdded), 0);
            const totalCost = filteredSessions.reduce((sum, s) => sum + parseFloat(s.cost), 0);
            const averageEnergy = totalSessions > 0 ? totalEnergy / totalSessions : 0;
            
            document.getElementById('totalSessions').textContent = totalSessions;
            document.getElementById('totalEnergy').textContent = `${totalEnergy.toFixed(1)} kWh`;
            document.getElementById('totalCost').textContent = `£${totalCost.toFixed(2)}`;
            document.getElementById('avgEnergy').textContent = `${averageEnergy.toFixed(1)} kWh`;
        } else {
            // Use all stats
            document.getElementById('totalSessions').textContent = allStats.totalSessions;
            document.getElementById('totalEnergy').textContent = `${allStats.totalEnergy.toFixed(1)} kWh`;
            document.getElementById('totalCost').textContent = `£${allStats.totalCost.toFixed(2)}`;
            document.getElementById('avgEnergy').textContent = `${allStats.averageEnergy.toFixed(1)} kWh`;
        }
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
    
    const source = session.source || 'manual';
    const sourceBadge = `<span class="session-source ${source}">${source === 'octopus' ? 'OCTOPUS AUTO' : 'MANUAL'}</span>`;
    
    return `
        <div class="session-card">
            <div class="session-header">
                <div class="session-date">
                    ${formatDate(session.date)} 
                    <span style="color: #888; font-size: 0.8em;">${session.startTime} - ${session.endTime}</span>
                    ${sourceBadge}
                </div>
                <button class="btn btn-danger delete-btn" data-id="${session.id}" title="Delete session">
                    <span class="delete-icon">×</span>
                    <span class="delete-text">Delete</span>
                </button>
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
                    <span class="detail-label">Tariff Rate</span>
                    <span class="detail-value">${session.tariffRate}p/kWh</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Cost</span>
                    <span class="detail-value">£${parseFloat(session.cost).toFixed(2)}</span>
                </div>
            </div>
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
            // Close the modal
            document.getElementById('manualEntryModal').style.display = 'none';
            document.body.style.overflow = 'auto';
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

// Filter sessions by date range
function filterSessionsByDate(sessions, filter) {
    if (filter === 'all') return sessions;
    
    const now = new Date();
    const daysMap = { '7': 7, '30': 30, '90': 90 };
    const days = daysMap[filter];
    
    if (!days) return sessions;
    
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return sessions.filter(session => {
        const sessionDate = new Date(session.date);
        return sessionDate >= cutoffDate;
    });
}

// Update filter button states
function updateFilterButtons(activeFilter) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.dataset.filter === activeFilter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
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

// Setup modals
function setupModals() {
    // Get modals
    const manualModal = document.getElementById('manualEntryModal');
    const importModal = document.getElementById('importModal');
    
    // Get buttons
    const openManualBtn = document.getElementById('openManualEntryModal');
    const openImportBtn = document.getElementById('openImportModal');
    
    // Get close buttons
    const closeBtns = document.querySelectorAll('.close');
    const cancelBtns = document.querySelectorAll('.btn-cancel');
    
    // Open modals
    openManualBtn.addEventListener('click', () => {
        manualModal.style.display = 'flex';
        setDefaultDate();
        document.body.style.overflow = 'hidden'; // Prevent background scroll
    });
    
    openImportBtn.addEventListener('click', () => {
        importModal.style.display = 'flex';
        setDefaultDate(); // Set import dates
        document.body.style.overflow = 'hidden';
    });
    
    // Close modal function
    function closeModal(modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        // Reset forms
        if (modal.id === 'manualEntryModal') {
            document.getElementById('sessionForm').reset();
            setDefaultDate();
            document.getElementById('tariffRate').value = '7.5';
        }
    }
    
    // Close buttons
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.modal;
            const modal = document.getElementById(modalId);
            closeModal(modal);
        });
    });
    
    // Cancel buttons
    cancelBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.modal;
            const modal = document.getElementById(modalId);
            closeModal(modal);
        });
    });
    
    // Click outside to close
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target);
        }
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
            
            // Store last import info
            storeLastImportInfo(data.imported);
            displayLastImportInfo();
            
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

// Store last import information
function storeLastImportInfo(count) {
    const importInfo = {
        timestamp: new Date().toISOString(),
        count: count
    };
    localStorage.setItem('lastImport', JSON.stringify(importInfo));
}

// Display last import information
async function displayLastImportInfo() {
    const lastImportDiv = document.getElementById('lastImportInfo');
    
    try {
        // Try to fetch from API first
        const response = await fetch(`${API_URL}/settings/last_import`);
        const data = await response.json();
        
        if (!data.value) {
            // Fallback to localStorage for backwards compatibility
            const localData = localStorage.getItem('lastImport');
            if (!localData) {
                lastImportDiv.innerHTML = `No automatic imports yet - use "Import Sessions" below to get started`;
                lastImportDiv.style.display = 'block';
                return;
            }
            const { timestamp, count } = JSON.parse(localData);
            displayImportInfo(timestamp, count, lastImportDiv);
            return;
        }
        
        // Use data from API
        const { timestamp, count } = data.value;
        displayImportInfo(timestamp, count, lastImportDiv);
    } catch (error) {
        console.error('Error fetching last import info:', error);
        // Fallback to localStorage
        const localData = localStorage.getItem('lastImport');
        if (localData) {
            const { timestamp, count } = JSON.parse(localData);
            displayImportInfo(timestamp, count, lastImportDiv);
        }
    }
}

function displayImportInfo(timestamp, count, element) {
    const importDate = new Date(timestamp);
    
    // Format time as HH:MM
    const timeStr = importDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    
    // Format date as "14th Feb"
    const day = importDate.getDate();
    const suffix = ['th', 'st', 'nd', 'rd'][day % 10 > 3 ? 0 : (day % 100 - day % 10 !== 10) * day % 10];
    const monthStr = importDate.toLocaleDateString('en-GB', { month: 'short' });
    const dateStr = `${day}${suffix} ${monthStr}`;
    
    // Show message based on count
    let message;
    if (count === 0) {
        message = `Last refresh at ${timeStr} on ${dateStr} - no new sessions found`;
    } else {
        message = `Last refresh at ${timeStr} on ${dateStr} - ${count} session${count !== 1 ? 's' : ''} imported`;
    }
    
    element.innerHTML = message;
    element.style.display = 'block';
}

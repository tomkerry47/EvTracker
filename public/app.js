// API Base URL
const API_URL = '/api';
const TRACKED_MILEAGE_VEHICLES = ['Kia EV5', 'Peugeot E-2008'];

let currentFilter = 'all';
let currentVehicleFilter = 'all';
let allSessionsCache = [];
let sessionsLoaded = false;
let mileageReadingsCache = [];
let latestMileageByVehicle = {};
let mileageLoaded = false;

// Load sessions on page load
document.addEventListener('DOMContentLoaded', async () => {
    setupForm();
    setDefaultDate();
    setupCostCalculation();
    setupImportForm();
    setupModals();
    setupAutoDetectRateToggle();
    setupFilterButtons();
    setupVehicleFilter();
    setupMileageForm();
    setupMobileFab();
    await loadSessions();
    try {
        await loadMileageHistory();
    } catch (error) {
        console.error('Error loading mileage history:', error);
    }
    await loadStats();
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
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    document.getElementById('date').value = today;
    
    // Set default import dates (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    document.getElementById('importDateFrom').value = sevenDaysAgo.toISOString().split('T')[0];
    document.getElementById('importDateTo').value = today;
    document.getElementById('tariffRate').value = '7.0';
    document.getElementById('importTariffRate').value = '7.0';
    if (document.getElementById('vehicle')) document.getElementById('vehicle').value = 'Kia EV5';
    setPillValue('vehicle', 'Kia EV5');
    if (document.getElementById('mileageVehicle')) document.getElementById('mileageVehicle').value = 'Kia EV5';
    setPillValue('mileageVehicle', 'Kia EV5');
    if (document.getElementById('mileageDate')) document.getElementById('mileageDate').value = today;
    if (document.getElementById('mileageTime')) document.getElementById('mileageTime').value = formatTimeInput(now);
    updateMileageCurrentInfo();
}

function setupVehicleFilter() {
    document.querySelectorAll('.pill-group').forEach(group => {
        const targetId = group.dataset.targetInput;
        const targetInput = document.getElementById(targetId);
        if (!targetInput) return;

        group.querySelectorAll('.pill-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                group.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                targetInput.value = btn.dataset.value;

                if (targetId === 'vehicleFilter') {
                    currentVehicleFilter = targetInput.value;
                    loadSessions(currentFilter);
                    loadStats(currentFilter);
                }

                if (targetId === 'mileageVehicle') {
                    updateMileageCurrentInfo();
                }
            });
        });
    });
}

function setPillValue(targetId, value) {
    const group = document.querySelector(`.pill-group[data-target-input="${targetId}"]`);
    if (!group) return;
    group.querySelectorAll('.pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === value);
    });
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

function setupMileageForm() {
    const form = document.getElementById('mileageForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveMileageReading();
    });
}

async function ensureSessionsLoaded(force = false) {
    if (!force && sessionsLoaded) return allSessionsCache;

    const response = await fetch(`${API_URL}/sessions`);
    if (!response.ok) {
        throw new Error('Failed to load charging sessions');
    }

    allSessionsCache = await response.json();
    sessionsLoaded = true;

    console.log('=== Frontend Received Sessions ===');
    console.log('Total sessions:', allSessionsCache.length);
    if (allSessionsCache.length > 0) {
        console.log('First session:');
        console.log('  date:', allSessionsCache[0].date, 'Type:', typeof allSessionsCache[0].date);
        console.log('  startTime:', allSessionsCache[0].startTime);
        console.log('  endTime:', allSessionsCache[0].endTime);
        console.log('  source:', allSessionsCache[0].source);
    }
    console.log('=== End Frontend Receive ===');

    return allSessionsCache;
}

async function loadMileageHistory(force = false) {
    if (!force && mileageLoaded) {
        updateMileageCurrentInfo();
        return mileageReadingsCache;
    }

    const response = await fetch(`${API_URL}/mileage`);
    if (!response.ok) {
        throw new Error('Failed to load mileage history');
    }

    const data = await response.json();
    mileageReadingsCache = Array.isArray(data.readings) ? data.readings : [];
    latestMileageByVehicle = data.latestByVehicle || {};
    mileageLoaded = true;
    updateMileageCurrentInfo();
    return mileageReadingsCache;
}

// Load and display all sessions
async function loadSessions(filter = currentFilter, options = {}) {
    currentFilter = filter;
    try {
        const sessions = await ensureSessionsLoaded(options.force === true);
        // Filter sessions based on current filter
        const filteredSessions = filterSessionsByDateAndVehicle(sessions, filter, currentVehicleFilter);
        displaySessions(filteredSessions);
        updateFilterButtons(filter);
    } catch (error) {
        console.error('Error loading sessions:', error);
        alert('Failed to load charging sessions');
    }
}

// Load and display statistics
async function loadStats(filter = currentFilter, options = {}) {
    try {
        const allSessions = await ensureSessionsLoaded(options.forceSessions === true);
        try {
            await loadMileageHistory(options.forceMileage === true);
        } catch (mileageError) {
            console.error('Error loading mileage history:', mileageError);
            mileageReadingsCache = [];
            latestMileageByVehicle = {};
            mileageLoaded = false;
        }
        const filteredSessions = filterSessionsByDateAndVehicle(allSessions, filter, currentVehicleFilter);
        const totalSessions = filteredSessions.length;
        const totalEnergy = filteredSessions.reduce((sum, s) => sum + parseFloat(s.energyAdded), 0);
        const totalCost = filteredSessions.reduce((sum, s) => sum + parseFloat(s.cost), 0);
        const averageEnergy = totalSessions > 0 ? totalEnergy / totalSessions : 0;
        const mileageStats = calculateMileageStats(filteredSessions, filter, currentVehicleFilter);

        document.getElementById('totalSessions').textContent = totalSessions;
        document.getElementById('totalEnergy').textContent = `${totalEnergy.toFixed(1)} kWh`;
        document.getElementById('totalCost').textContent = `£${totalCost.toFixed(2)}`;
        document.getElementById('avgEnergy').textContent = `${averageEnergy.toFixed(1)} kWh`;
        document.getElementById('costPerMile').textContent = mileageStats.label;
        document.getElementById('costPerMileMeta').textContent = mileageStats.meta;
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
            const button = e.target.closest('.delete-btn');
            const id = button ? button.dataset.id : null;
            if (!id) return;
            if (confirm('Are you sure you want to delete this session?')) {
                await deleteSession(id);
            }
        });
    });

    setupSessionVehiclePills();
}

// Create HTML for a session card
function createSessionCard(session) {
    const duration = calculateChargingDuration(session);
    const avgSpeedKw = calculateAverageChargingSpeed(session);
    
    const source = session.source || 'manual';
    const isAutoSource = source.startsWith('octopus');
    const sourceBadge = `<span class="session-source ${source}">${isAutoSource ? 'OCTOPUS AUTO' : 'MANUAL'}</span>`;
    const vehiclePills = isAutoSource ? renderSessionVehiclePills(session) : '';
    const dispatchBlocks = Array.isArray(session.dispatchBlocks) ? session.dispatchBlocks : [];
    const dispatchGraph = dispatchBlocks.length ? `
        <div class="dispatch-graph">
            ${buildDispatchBars(dispatchBlocks, parseFloat(session.tariffRate) || 7.0)}
        </div>
    ` : '';
    
    const deleteButton = `
                <button class="btn btn-danger delete-btn" data-id="${session.id}" title="Delete session">
                    <span class="delete-icon">×</span>
                    <span class="delete-text">Delete</span>
                </button>
    `;

    return `
        <div class="session-card">
            <div class="session-header">
                <div class="session-date">
                    ${formatDate(session.date)} 
                    <span style="color: #888; font-size: 0.8em;">${session.startTime} - ${session.endTime}</span>
                    ${sourceBadge}
                </div>
                ${vehiclePills}
                ${deleteButton}
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
                    <span class="detail-label">Avg Speed</span>
                    <span class="detail-value">${avgSpeedKw.toFixed(2)} kW</span>
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
            ${dispatchGraph}
        </div>
    `;
}

function getSessionVehicle(session) {
    if (session.vehicle) return session.vehicle;
    if ((session.source || '').startsWith('octopus')) return 'Kia EV5';
    return null;
}

function renderSessionVehiclePills(session) {
    const selected = getSessionVehicle(session) || 'Kia EV5';
    const options = ['Kia EV5', 'Peugeot E-2008', 'Other'];
    return `
        <div class="session-vehicle-pills" data-session-id="${session.id}">
            ${options.map((value) => `
                <button type="button" class="pill-btn session-pill-btn ${selected === value ? 'active' : ''}" data-value="${value}">${value}</button>
            `).join('')}
        </div>
    `;
}

function setupSessionVehiclePills() {
    document.querySelectorAll('.session-vehicle-pills').forEach(group => {
        const sessionId = group.dataset.sessionId;
        if (!sessionId) return;
        group.querySelectorAll('.session-pill-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const vehicle = btn.dataset.value;
                if (!vehicle) return;
                await updateSessionVehicle(sessionId, vehicle);
            });
        });
    });
}

async function updateSessionVehicle(sessionId, vehicle) {
    try {
        const response = await fetch(`${API_URL}/sessions/${sessionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vehicle })
        });
        if (!response.ok) {
            throw new Error('Failed to update vehicle');
        }
        await loadSessions(currentFilter, { force: true });
        await loadStats(currentFilter);
    } catch (error) {
        console.error('Error updating session vehicle:', error);
        alert('Failed to update vehicle');
    }
}

function buildDispatchBars(dispatchBlocks, tariffRate) {
    const normalized = dispatchBlocks
        .map((block) => {
            const chargedKwh = Math.abs(parseFloat(block.charged_kwh ?? block.charge_in_kwh ?? 0) || 0);
            const start = new Date(block.start);
            const end = new Date(block.end);
            const startTime = Number.isNaN(start.getTime()) ? '--:--' : formatUkTime(start);
            const endTime = Number.isNaN(end.getTime()) ? '--:--' : formatUkTime(end);
            const blockCost = Number.isFinite(parseFloat(block.cost))
                ? parseFloat(block.cost)
                : (chargedKwh * tariffRate / 100);
            return { chargedKwh, blockCost, start, end, startTime, endTime };
        })
        .filter((block) => block.chargedKwh > 0)
        .sort((a, b) => a.start - b.start);
    
    if (!normalized.length) return '';

    const merged = [];
    for (const block of normalized) {
        const current = merged[merged.length - 1];
        if (!current) {
            merged.push({ ...block });
            continue;
        }
        const isConsecutive = !Number.isNaN(current.end.getTime())
            && !Number.isNaN(block.start.getTime())
            && current.end.getTime() === block.start.getTime();
        if (isConsecutive) {
            current.end = block.end;
            current.endTime = block.endTime;
            current.chargedKwh += block.chargedKwh;
            current.blockCost += block.blockCost;
        } else {
            merged.push({ ...block });
        }
    }
    
    const maxKwh = Math.max(...merged.map((block) => block.chargedKwh), 0.01);
    return merged.map((block) => {
        const width = Math.max(6, Math.round((block.chargedKwh / maxKwh) * 100));
        return `
            <div class="dispatch-bar-row">
                <span class="dispatch-bar-label">${block.startTime}-${block.endTime}</span>
                <div class="dispatch-bar-track"><div class="dispatch-bar-fill" style="width:${width}%"></div></div>
                <span class="dispatch-bar-kwh">${block.chargedKwh.toFixed(2)}kWh · £${block.blockCost.toFixed(2)}</span>
            </div>
        `;
    }).join('');
}

function formatUkTime(date) {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(date);
}

// Add a new session
async function addSession() {
    const sessionData = {
        date: document.getElementById('date').value,
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        energyAdded: parseFloat(document.getElementById('energyAdded').value),
        vehicle: document.getElementById('vehicle').value,
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
            document.getElementById('tariffRate').value = '7.0';
            // Close the modal
            document.getElementById('manualEntryModal').style.display = 'none';
            document.body.style.overflow = 'auto';
            await loadSessions(currentFilter, { force: true });
            await loadStats(currentFilter);
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
            await loadSessions(currentFilter, { force: true });
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

function calculateChargingDuration(session) {
    const blocks = Array.isArray(session.dispatchBlocks) ? session.dispatchBlocks : [];

    // For completedDispatches, duration should represent active charging blocks.
    // Prefer persisted dispatch count (30-minute blocks) over window span.
    const dispatchCount = Number(session.dispatchCount);
    if (Number.isFinite(dispatchCount) && dispatchCount > 0) {
        const totalMinutes = Math.round(dispatchCount * 30);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours}h ${minutes}m`;
    }

    if (!blocks.length) {
        return calculateDuration(session.startTime, session.endTime);
    }

    const totalMinutes = blocks.reduce((sum, block) => {
        const start = new Date(block.start);
        const end = new Date(block.end);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return sum;
        const minutes = Math.max(0, Math.round((end - start) / 1000 / 60));
        return sum + minutes;
    }, 0);

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
}

function calculateAverageChargingSpeed(session) {
    const totalKwh = parseFloat(session.energyAdded) || 0;
    if (totalKwh <= 0) return 0;

    const blocks = Array.isArray(session.dispatchBlocks) ? session.dispatchBlocks : [];
    const dispatchCount = Number(session.dispatchCount);
    if (Number.isFinite(dispatchCount) && dispatchCount > 0) {
        const hours = dispatchCount * 0.5;
        return hours > 0 ? totalKwh / hours : 0;
    }

    if (blocks.length) {
        const totalHours = blocks.reduce((sum, block) => {
            const start = new Date(block.start);
            const end = new Date(block.end);
            return sum + calculateDurationHours(start, end);
        }, 0);
        return totalHours > 0 ? totalKwh / totalHours : 0;
    }

    const start = new Date(`2000-01-01 ${session.startTime}`);
    const end = new Date(`2000-01-01 ${session.endTime}`);
    let hours = (end - start) / 1000 / 60 / 60;
    if (hours < 0) hours += 24;
    return hours > 0 ? totalKwh / hours : 0;
}

function calculateDurationHours(start, end) {
    if (!(start instanceof Date) || !(end instanceof Date)) return 0;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    return Math.max(0, (end - start) / 1000 / 60 / 60);
}

// Filter sessions by date range and vehicle
function filterSessionsByDateAndVehicle(sessions, filter, vehicleFilter) {
    let filtered = sessions;

    const now = new Date();
    const daysMap = { '7': 7, '30': 30, '90': 90 };
    const days = daysMap[filter];
    
    if (days) {
        const cutoffDate = new Date(now);
        cutoffDate.setDate(cutoffDate.getDate() - days);
        filtered = filtered.filter(session => {
            const sessionDate = new Date(session.date);
            return sessionDate >= cutoffDate;
        });
    }

    if (vehicleFilter && vehicleFilter !== 'all') {
        filtered = filtered.filter(session => getSessionVehicle(session) === vehicleFilter);
    }

    return filtered;
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

function formatTimeInput(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatMileageTimestamp(timestamp) {
    const value = new Date(timestamp);
    if (Number.isNaN(value.getTime())) return 'Unknown time';
    return value.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function updateMileageCurrentInfo() {
    const infoEl = document.getElementById('mileageCurrentInfo');
    const vehicle = document.getElementById('mileageVehicle')?.value;
    if (!infoEl || !vehicle) return;

    const latest = latestMileageByVehicle[vehicle];
    if (!latest) {
        infoEl.textContent = 'No mileage reading recorded yet for this vehicle.';
        return;
    }

    infoEl.textContent = `Latest for ${vehicle}: ${Number(latest.mileage).toLocaleString('en-GB')} miles at ${formatMileageTimestamp(latest.recordedAt)}`;
}

function getFilterDateRange(filter) {
    const end = new Date();
    const daysMap = { '7': 7, '30': 30, '90': 90 };
    const days = daysMap[filter];

    if (!days) {
        return { start: null, end };
    }

    const start = new Date(end);
    start.setDate(start.getDate() - days);
    return { start, end };
}

function getLatestReadingOnOrBefore(readings, cutoffDate) {
    const cutoffMs = cutoffDate instanceof Date ? cutoffDate.getTime() : Number.POSITIVE_INFINITY;
    return readings
        .filter((reading) => new Date(reading.recordedAt).getTime() <= cutoffMs)
        .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt))
        .pop() || null;
}

function calculateMileageForVehicle(vehicle, filter) {
    const readings = mileageReadingsCache
        .filter((reading) => reading.vehicle === vehicle)
        .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));

    if (!readings.length) {
        return null;
    }

    const { start, end } = getFilterDateRange(filter);
    const startReading = start ? getLatestReadingOnOrBefore(readings, start) : readings[0];
    const endReading = getLatestReadingOnOrBefore(readings, end);

    if (!startReading || !endReading) {
        return null;
    }

    return {
        startReading,
        endReading,
        miles: Math.max(0, Number(endReading.mileage) - Number(startReading.mileage))
    };
}

function calculateMileageStats(filteredSessions, filter, vehicleFilter) {
    const selectedVehicles = vehicleFilter === 'all'
        ? TRACKED_MILEAGE_VEHICLES
        : TRACKED_MILEAGE_VEHICLES.filter((vehicle) => vehicle === vehicleFilter);

    if (!selectedVehicles.length) {
        return {
            label: '--',
            meta: 'Mileage tracking is available for the EV5 and E-2008.'
        };
    }

    let totalTrackedCost = 0;
    let totalTrackedMiles = 0;
    let vehiclesIncluded = 0;

    for (const vehicle of selectedVehicles) {
        const vehicleSessions = filteredSessions.filter((session) => getSessionVehicle(session) === vehicle);
        if (!vehicleSessions.length && vehicleFilter === 'all') {
            continue;
        }

        const mileageWindow = calculateMileageForVehicle(vehicle, filter);
        if (!mileageWindow || mileageWindow.miles <= 0) {
            continue;
        }

        const vehicleCost = vehicleSessions.reduce((sum, session) => sum + (parseFloat(session.cost) || 0), 0);
        totalTrackedCost += vehicleCost;
        totalTrackedMiles += mileageWindow.miles;
        vehiclesIncluded++;
    }

    if (totalTrackedMiles <= 0) {
        return {
            label: '--',
            meta: 'Add a newer mileage reading to calculate cost per mile.'
        };
    }

    const suffix = vehiclesIncluded > 1 ? ` across ${vehiclesIncluded} vehicles` : '';
    const trackedNote = vehicleFilter === 'all' ? ' Tracked vehicles only.' : '';
    return {
        label: `£${(totalTrackedCost / totalTrackedMiles).toFixed(2)}/mi`,
        meta: `${totalTrackedMiles.toFixed(1)} miles tracked${suffix}.${trackedNote}`.trim()
    };
}

// Setup modals
function setupModals() {
    // Get modals
    const manualModal = document.getElementById('manualEntryModal');
    const importModal = document.getElementById('importModal');
    
    // Get close buttons
    const closeBtns = document.querySelectorAll('.close');
    const cancelBtns = document.querySelectorAll('.btn-cancel');
    
    // Open modals from generic triggers
    document.querySelectorAll('[data-open-modal]').forEach(trigger => {
        trigger.addEventListener('click', () => {
            const modalId = trigger.dataset.openModal;
            const modal = document.getElementById(modalId);
            if (!modal) return;
            modal.style.display = 'flex';
            setDefaultDate();
            document.body.style.overflow = 'hidden';
            closeMobileFab();
        });
    });
    
    // Close modal function
    function closeModal(modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        // Reset forms
        if (modal.id === 'manualEntryModal') {
            document.getElementById('sessionForm').reset();
            setDefaultDate();
            document.getElementById('tariffRate').value = '7.0';
        }
        if (modal.id === 'mileageModal') {
            document.getElementById('mileageForm').reset();
            setDefaultDate();
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

function setupMobileFab() {
    const toggle = document.getElementById('mobileFabToggle');
    const menu = document.getElementById('mobileFabMenu');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', () => {
        const isOpen = menu.classList.toggle('open');
        toggle.classList.toggle('open', isOpen);
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.mobile-fab-wrap')) {
            closeMobileFab();
        }
    });
}

function closeMobileFab() {
    const toggle = document.getElementById('mobileFabToggle');
    const menu = document.getElementById('mobileFabMenu');
    if (!toggle || !menu) return;
    menu.classList.remove('open');
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
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
    const mergeGapHours = parseFloat(document.getElementById('importMergeGapHours').value);
    const autoDetectRate = document.getElementById('autoDetectRate').checked;
    const tariffRate = autoDetectRate ? null : parseFloat(document.getElementById('importTariffRate').value);
    const accountNumber = document.getElementById('importAccountNumber').value.trim();
    const statusDiv = document.getElementById('importStatus');
    const importButton = document.getElementById('importButton');
    
    if (!dateFrom || !dateTo) {
        showImportStatus('Please select both from and to dates', 'error');
        return;
    }
    if (!Number.isFinite(mergeGapHours) || mergeGapHours < 0) {
        showImportStatus('Merge gap must be 0 or greater', 'error');
        return;
    }
    
    // Disable button and show loading
    importButton.disabled = true;
    importButton.textContent = 'Importing...';
    const rateMsg = autoDetectRate ? 'auto-detecting rates' : `using ${tariffRate}p/kWh`;
    showImportStatus(`Fetching completed dispatches from Octopus GraphQL (${rateMsg})...`, 'info');
    
    try {
        const response = await fetch(`${API_URL}/octopus/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                dateFrom, 
                dateTo, 
                mergeGapHours,
                tariffRate, 
                autoDetectRate,
                accountNumber: accountNumber || null
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const detected = Number.isFinite(data.detected) ? data.detected : (data.imported + data.skipped);
            const modeLabel = data.mode === 'completed-dispatches-graphql'
                ? 'completedDispatches'
                : (data.mode || 'unknown mode');
            const updated = Number.isFinite(data.updated) ? data.updated : 0;
            const inserted = Math.max(0, data.imported - updated);
            const message = `[${modeLabel}] Detected ${detected} session(s): ${inserted} new, ${updated} updated${data.skipped > 0 ? `, ${data.skipped} duplicate(s) skipped` : ''}`;
            showImportStatus(message, 'success');
            
            // Store last import info
            storeLastImportInfo(data.imported, data.detected, data.skipped);
            displayLastImportInfo();
            
            // Reload sessions and stats
            await loadSessions(currentFilter, { force: true });
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
function storeLastImportInfo(count, totalDetected = null, skipped = null) {
    const importInfo = {
        timestamp: new Date().toISOString(),
        count: count,
        total_detected: Number.isFinite(totalDetected) ? totalDetected : null,
        skipped: Number.isFinite(skipped) ? skipped : null
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
            const { timestamp, count, total_detected, skipped } = JSON.parse(localData);
            displayImportInfo(timestamp, count, lastImportDiv, total_detected, skipped);
            return;
        }
        
        // Use data from API
        const { timestamp, count, total_detected, skipped } = data.value;
        displayImportInfo(timestamp, count, lastImportDiv, total_detected, skipped);
    } catch (error) {
        console.error('Error fetching last import info:', error);
        // Fallback to localStorage
        const localData = localStorage.getItem('lastImport');
        if (localData) {
            const { timestamp, count, total_detected, skipped } = JSON.parse(localData);
            displayImportInfo(timestamp, count, lastImportDiv, total_detected, skipped);
        }
    }
}

function displayImportInfo(timestamp, count, element, totalDetected = null, skipped = null) {
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
    if (count === 0 && Number.isFinite(totalDetected) && totalDetected > 0) {
        message = `Last refresh at ${timeStr} on ${dateStr} - ${totalDetected} detected, all already imported`;
    } else if (count === 0) {
        message = `Last refresh at ${timeStr} on ${dateStr} - no sessions detected`;
    } else {
        const skippedText = Number.isFinite(skipped) && skipped > 0 ? `, ${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped` : '';
        message = `Last refresh at ${timeStr} on ${dateStr} - ${count} session${count !== 1 ? 's' : ''} imported${skippedText}`;
    }
    
    element.innerHTML = message;
    element.style.display = 'block';
}

async function saveMileageReading() {
    const vehicle = document.getElementById('mileageVehicle').value;
    const mileage = parseFloat(document.getElementById('mileageValue').value);
    const date = document.getElementById('mileageDate').value;
    const time = document.getElementById('mileageTime').value;

    if (!vehicle || !date || !time || !Number.isFinite(mileage) || mileage < 0) {
        alert('Please enter a vehicle, mileage, date, and time.');
        return;
    }

    const recordedAt = new Date(`${date}T${time}`);
    if (Number.isNaN(recordedAt.getTime())) {
        alert('Please enter a valid mileage date and time.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/mileage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                vehicle,
                mileage,
                recordedAt: recordedAt.toISOString()
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to save mileage');
        }

        await loadMileageHistory(true);
        document.getElementById('mileageModal').style.display = 'none';
        document.body.style.overflow = 'auto';
        document.getElementById('mileageForm').reset();
        setDefaultDate();
        await loadStats(currentFilter);
    } catch (error) {
        console.error('Error saving mileage:', error);
        alert(error.message || 'Failed to save mileage');
    }
}

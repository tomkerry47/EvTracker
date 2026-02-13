const axios = require('axios');

/**
 * Octopus Energy API Client
 * Handles authentication and API calls to Octopus Energy
 */
class OctopusEnergyClient {
  constructor(apiKey, mpan, serial) {
    this.apiKey = apiKey;
    this.mpan = mpan;
    this.serial = serial;
    this.baseURL = 'https://api.octopus.energy/v1';
  }

  /**
   * Get electricity consumption data for a date range
   * @param {string} periodFrom - ISO 8601 datetime (e.g., "2024-01-01T00:00:00Z")
   * @param {string} periodTo - ISO 8601 datetime
   * @param {object} options - Additional options (pageSize, orderBy)
   * @returns {Promise<object>} Consumption data with results array
   */
  async getConsumption(periodFrom, periodTo, options = {}) {
    const params = {
      period_from: periodFrom,
      period_to: periodTo,
      page_size: options.pageSize || 1000,
      order_by: options.orderBy || 'period'
    };

    try {
      const response = await axios.get(
        `${this.baseURL}/electricity-meter-points/${this.mpan}/meters/${this.serial}/consumption/`,
        {
          auth: { 
            username: this.apiKey, 
            password: '' 
          },
          params
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching consumption data:', error.response?.data || error.message);
      throw new Error(`Failed to fetch consumption: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Detect charging sessions from consumption data
   * Identifies periods with high consumption (> threshold kWh per 30 min)
   * @param {Array} consumptionData - Array of consumption intervals
   * @param {number} threshold - Minimum kWh per interval to consider charging (default: 2.0)
   * @returns {Array} Detected charging sessions
   */
  detectChargingSessions(consumptionData, threshold = 2.0) {
    const sessions = [];
    let currentSession = null;

    // Sort by time (ascending)
    const sortedData = [...consumptionData].sort((a, b) => 
      new Date(a.interval_start) - new Date(b.interval_start)
    );

    for (const interval of sortedData) {
      // Check if this interval represents charging
      if (interval.consumption >= threshold) {
        if (!currentSession) {
          // Start new session
          currentSession = {
            intervals: [interval],
            startTime: interval.interval_start
          };
        } else {
          // Check if this interval is consecutive (within 1 hour of last interval)
          const lastInterval = currentSession.intervals[currentSession.intervals.length - 1];
          const timeDiff = new Date(interval.interval_start) - new Date(lastInterval.interval_end);
          const oneHour = 60 * 60 * 1000;

          if (timeDiff <= oneHour) {
            // Continue existing session
            currentSession.intervals.push(interval);
          } else {
            // Gap detected, finish current session and start new one
            currentSession.endTime = lastInterval.interval_end;
            sessions.push(currentSession);
            
            currentSession = {
              intervals: [interval],
              startTime: interval.interval_start
            };
          }
        }
      } else {
        // Low consumption - end current session if exists
        if (currentSession) {
          const lastInterval = currentSession.intervals[currentSession.intervals.length - 1];
          currentSession.endTime = lastInterval.interval_end;
          sessions.push(currentSession);
          currentSession = null;
        }
      }
    }

    // Don't forget the last session if it exists
    if (currentSession) {
      const lastInterval = currentSession.intervals[currentSession.intervals.length - 1];
      currentSession.endTime = lastInterval.interval_end;
      sessions.push(currentSession);
    }

    // Calculate totals for each session
    return sessions.map(session => {
      const totalEnergy = session.intervals.reduce((sum, interval) => 
        sum + interval.consumption, 0
      );

      return {
        startTime: session.startTime,
        endTime: session.endTime,
        intervals: session.intervals,
        totalEnergy: parseFloat(totalEnergy.toFixed(3)),
        intervalCount: session.intervals.length
      };
    });
  }

  /**
   * Transform Octopus session data to EvTracker format
   * @param {object} octopusSession - Session detected from Octopus data
   * @param {number} tariffRate - Tariff rate in pence/kWh (default: 7.5 for Intelligent Go off-peak)
   * @returns {object} Session in EvTracker format
   */
  transformToEvTrackerFormat(octopusSession, tariffRate = 7.5) {
    const startDate = new Date(octopusSession.startTime);
    const endDate = new Date(octopusSession.endTime);

    // Calculate cost
    const cost = (octopusSession.totalEnergy * tariffRate) / 100;

    // Extract date and time in UK timezone (Europe/London)
    // Octopus Energy is UK-based, so times should be in UK timezone
    const ukDateFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const ukTimeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    // Format date as YYYY-MM-DD for database
    const dateParts = ukDateFormatter.formatToParts(startDate);
    const year = dateParts.find(p => p.type === 'year').value;
    const month = dateParts.find(p => p.type === 'month').value;
    const day = dateParts.find(p => p.type === 'day').value;
    const formattedDate = `${year}-${month}-${day}`;

    // Format times as HH:MM for database
    const startTime = ukTimeFormatter.format(startDate);
    const endTime = ukTimeFormatter.format(endDate);

    return {
      date: formattedDate,
      startTime: startTime,
      endTime: endTime,
      energyAdded: octopusSession.totalEnergy,
      tariffRate: tariffRate,
      cost: parseFloat(cost.toFixed(2)),
      startSoC: null,
      endSoC: null,
      notes: `Auto-imported from Octopus Energy (${octopusSession.intervalCount} intervals)`,
      source: 'octopus',
      octopusSessionId: `${octopusSession.startTime}_${octopusSession.endTime}`
    };
  }

  /**
   * Import charging sessions for a date range
   * @param {string} dateFrom - Date string (YYYY-MM-DD)
   * @param {string} dateTo - Date string (YYYY-MM-DD)
   * @param {number} threshold - Consumption threshold for charging detection
   * @param {number} tariffRate - Tariff rate in pence/kWh
   * @returns {Promise<Array>} Detected and transformed sessions
   */
  async importSessions(dateFrom, dateTo, threshold = 2.0, tariffRate = 7.5) {
    // Convert dates to ISO 8601 format with Z timezone
    const periodFrom = `${dateFrom}T00:00:00Z`;
    const periodTo = `${dateTo}T23:59:59Z`;

    // Fetch consumption data
    const consumptionData = await this.getConsumption(periodFrom, periodTo);

    // Detect charging sessions
    const detectedSessions = this.detectChargingSessions(consumptionData.results, threshold);

    // Transform to EvTracker format
    const transformedSessions = detectedSessions.map(session => 
      this.transformToEvTrackerFormat(session, tariffRate)
    );

    return transformedSessions;
  }
}

module.exports = OctopusEnergyClient;

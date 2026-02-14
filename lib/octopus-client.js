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

    console.log('=== Date Transformation Debug ===');
    console.log('Original Octopus startTime:', octopusSession.startTime);
    console.log('Original Octopus endTime:', octopusSession.endTime);
    console.log('Parsed startDate object:', startDate.toISOString());
    console.log('Parsed endDate object:', endDate.toISOString());

    // Calculate cost
    const cost = (octopusSession.totalEnergy * tariffRate) / 100;

    // Extract date and time in UK timezone (Europe/London)
    // Octopus Energy is UK-based, so times should be in UK timezone
    // Use en-CA for ISO-like format, but with UK timezone
    const ukDateFormatter = new Intl.DateTimeFormat('en-CA', {
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

    // Format date as YYYY-MM-DD for PostgreSQL DATE type
    // en-CA locale gives YYYY-MM-DD format directly
    const formattedDate = ukDateFormatter.format(startDate);

    // Format times as HH:MM for PostgreSQL TIME type
    const startTime = ukTimeFormatter.format(startDate);
    const endTime = ukTimeFormatter.format(endDate);

    console.log('Formatted date (YYYY-MM-DD):', formattedDate);
    console.log('Formatted startTime (HH:MM):', startTime);
    console.log('Formatted endTime (HH:MM):', endTime);
    console.log('=== End Debug ===');

    return {
      date: formattedDate,
      startTime: startTime,
      endTime: endTime,
      energyAdded: octopusSession.totalEnergy,
      tariffRate: tariffRate,
      cost: parseFloat(cost.toFixed(2)),
      startSoC: null,
      endSoC: null,
      notes: null,
      source: 'octopus',
      octopusSessionId: `${octopusSession.startTime}_${octopusSession.endTime}`
    };
  }

  /**
   * Get tariff rates for Intelligent Octopus Go
   * @param {string} periodFrom - ISO 8601 datetime
   * @param {string} periodTo - ISO 8601 datetime
   * @returns {Promise<Array>} Array of tariff rates with period and value
   */
  async getTariffRates(periodFrom, periodTo) {
    // Intelligent Octopus Go product code and tariff structure
    // E-1R-INTELLI-VAR-22-10-14-{region}
    // For simplicity, we'll use the standard off-peak rate
    // In a full implementation, we'd need the user's specific tariff code
    
    try {
      // This is a placeholder for tariff rate fetching
      // The actual implementation would need:
      // 1. User's account details to get their specific tariff code
      // 2. Region-specific tariff code (e.g., E-1R-INTELLI-VAR-22-10-14-N)
      // 3. API call to products endpoint
      
      console.log('Note: Automatic tariff rates not yet implemented');
      console.log('Using default Intelligent Go off-peak rate: 7.5p/kWh');
      
      // For now, return default Intelligent Go rates
      return {
        offPeak: 7.5,  // 11:30 PM - 5:30 AM
        peak: 24.5     // Rest of the day (approximate)
      };
    } catch (error) {
      console.error('Error fetching tariff rates:', error);
      // Return defaults on error
      return {
        offPeak: 7.5,
        peak: 24.5
      };
    }
  }

  /**
   * Get the Intelligent Octopus Go charging rate
   * IMPORTANT: For Intelligent Octopus Go with smart charging:
   * - ALL EV charging happens at the lower rate (7.5p/kWh)
   * - The system schedules charging during optimal times
   * - You always pay the smart charging rate for EV sessions
   * 
   * Note: In future, we can match against planned dispatches to detect
   * any "excess" usage outside scheduled windows (which would be at peak rate)
   * 
   * @returns {number} Rate in pence/kWh
   */
  getIntelligentOctopusChargingRate() {
    // All detected EV charging sessions get the smart charging rate
    return 7.5; // 7.5p per kWh
  }

  /**
   * Import charging sessions for a date range
   * @param {string} dateFrom - Date string (YYYY-MM-DD)
   * @param {string} dateTo - Date string (YYYY-MM-DD)
   * @param {number} threshold - Consumption threshold for charging detection
   * @param {number} tariffRate - Tariff rate in pence/kWh (optional, will auto-detect if not provided)
   * @returns {Promise<Array>} Detected and transformed sessions
   */
  async importSessions(dateFrom, dateTo, threshold = 2.0, tariffRate = null) {
    // Convert dates to ISO 8601 format with Z timezone
    const periodFrom = `${dateFrom}T00:00:00Z`;
    const periodTo = `${dateTo}T23:59:59Z`;

    // Fetch consumption data
    const consumptionData = await this.getConsumption(periodFrom, periodTo);

    // Detect charging sessions
    const detectedSessions = this.detectChargingSessions(consumptionData.results, threshold);

    // If no tariff rate provided, use Intelligent Octopus Go smart charging rate
    // All EV charging sessions get the smart charging rate (7.5p/kWh)
    const useAutoRate = tariffRate === null;
    
    // Transform to EvTracker format
    const transformedSessions = detectedSessions.map(session => {
      let sessionRate = tariffRate;
      
      // Auto-detect rate if not provided
      if (useAutoRate) {
        // For Intelligent Octopus Go, all EV charging gets the smart charging rate
        sessionRate = this.getIntelligentOctopusChargingRate(); // Always 7.5p
        console.log(`Using Intelligent Octopus Go smart charging rate: ${sessionRate}p/kWh for session starting ${session.startTime}`);
      }
      
      return this.transformToEvTrackerFormat(session, sessionRate || 7.5);
    });

    return transformedSessions;
  }
}

module.exports = OctopusEnergyClient;

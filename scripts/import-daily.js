#!/usr/bin/env node

/**
 * Daily Charge Import Script
 * 
 * Automatically imports the last 2 days of charging data from Octopus Energy API
 * Runs via GitHub Actions at 06:00 AM daily
 */

const { Pool } = require('pg');
const OctopusClient = require('../lib/octopus-client');

async function importDailyCharges() {
  console.log('=== Daily Charge Import Started ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  // Validate environment variables
  const requiredEnvVars = ['DATABASE_URL', 'OCTOPUS_API_KEY', 'OCTOPUS_MPAN', 'OCTOPUS_SERIAL'];
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
  
  // Initialize database connection
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
    
    // Initialize Octopus client
    const octopusClient = new OctopusClient(
      process.env.OCTOPUS_API_KEY,
      process.env.OCTOPUS_MPAN,
      process.env.OCTOPUS_SERIAL
    );
    console.log('✅ Octopus client initialized');
    
    // Calculate date range (last 2 days)
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 2);
    
    console.log(`📅 Importing from ${dateFrom.toISOString()} to ${dateTo.toISOString()}`);
    
    // Import sessions with auto-detect rate (7.5p for Intelligent Octopus Go)
    const result = await octopusClient.importSessions(
      dateFrom.toISOString().split('T')[0],
      dateTo.toISOString().split('T')[0],
      2.0,  // threshold (kWh)
      0.075, // tariffRate (7.5p)
      true  // autoDetectRate
    );
    
    console.log('\n=== Import Results ===');
    console.log(`✅ Sessions detected: ${result.sessions.length}`);
    
    // Insert sessions into database
    let imported = 0;
    let skipped = 0;
    
    for (const session of result.sessions) {
      try {
        const query = `
          INSERT INTO charging_sessions (
            id, date, energy_added, start_soc, end_soc, tariff_rate, cost,
            duration, notes, source, octopus_session_id, start_time, end_time
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (octopus_session_id) DO NOTHING
          RETURNING id
        `;
        
        const values = [
          session.id,
          session.date,
          session.energyAdded,
          session.startSoc,
          session.endSoc,
          session.tariffRate,
          session.cost,
          session.duration,
          session.notes,
          'octopus',
          session.octopusSessionId,
          session.startTime,
          session.endTime
        ];
        
        const insertResult = await pool.query(query, values);
        
        if (insertResult.rowCount > 0) {
          imported++;
          console.log(`  ✅ Imported: ${session.date} ${session.startTime} - ${session.energyAdded} kWh`);
        } else {
          skipped++;
          console.log(`  ⏭️  Skipped (duplicate): ${session.date} ${session.startTime}`);
        }
      } catch (error) {
        console.error(`  ❌ Error importing session:`, error.message);
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`✅ Successfully imported: ${imported} sessions`);
    console.log(`⏭️  Skipped (duplicates): ${skipped} sessions`);
    console.log(`💰 Total cost: £${result.sessions.reduce((sum, s) => sum + s.cost, 0).toFixed(2)}`);
    console.log(`⚡ Total energy: ${result.sessions.reduce((sum, s) => sum + s.energyAdded, 0).toFixed(2)} kWh`);
    console.log('=== Daily Charge Import Completed ===\n');
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the import
importDailyCharges().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

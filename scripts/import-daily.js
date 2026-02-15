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
    console.log(`✅ Sessions detected: ${result.length}`);
    
    // Insert sessions into database
    let imported = 0;
    let skipped = 0;
    
    for (const session of result) {
      try {
        // Generate unique ID using timestamp + random suffix to prevent collisions
        const id = Date.now().toString() + '-' + Math.random().toString(36).slice(2, 11);
        
        const query = `
          INSERT INTO charging_sessions (
            id, date, start_time, end_time, energy_added, start_soc, end_soc, 
            tariff_rate, cost, notes, source, octopus_session_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id
        `;
        
        const values = [
          id,
          session.date,
          session.startTime,
          session.endTime,
          session.energyAdded,
          session.startSoC,
          session.endSoC,
          session.tariffRate,
          session.cost,
          session.notes,
          'octopus',
          session.octopusSessionId
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
        // Handle duplicate octopus_session_id
        if (error.code === '23505') {
          skipped++;
          console.log(`  ⏭️  Skipped (duplicate): ${session.date} ${session.startTime}`);
        } else {
          console.error(`  ❌ Error importing session:`, error.message);
        }
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`✅ Successfully imported: ${imported} sessions`);
    console.log(`⏭️  Skipped (duplicates): ${skipped} sessions`);
    console.log(`💰 Total cost: £${result.reduce((sum, s) => sum + s.cost, 0).toFixed(2)}`);
    console.log(`⚡ Total energy: ${result.reduce((sum, s) => sum + s.energyAdded, 0).toFixed(2)} kWh`);
    
    // Store last import info in database (always, even if no new sessions)
    try {
      await pool.query(
        `INSERT INTO app_settings (key, value) 
         VALUES ('last_import', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify({ 
          timestamp: new Date().toISOString(), 
          count: imported,
          total_detected: result.length,
          skipped: skipped
        })]
      );
      console.log('✅ Last import info stored in database');
    } catch (error) {
      console.error('⚠️  Warning: Could not store last import info:', error.message);
    }
    
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

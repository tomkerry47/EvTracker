#!/usr/bin/env node

/**
 * Automated Charge Import Script
 * 
 * Imports recent completed dispatches from Octopus GraphQL and merges them
 * into charge sessions using a 4-hour block-gap rule.
 */

const { Pool } = require('pg');
const OctopusClient = require('../lib/octopus-client');

function formatUkDate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function formatUkTime(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function normalizeBlock(block, tariffRate) {
  const charged = Math.abs(parseFloat(block?.charged_kwh ?? block?.charge_in_kwh ?? 0) || 0);
  const cost = Number.isFinite(parseFloat(block?.cost))
    ? parseFloat(block.cost)
    : parseFloat(((charged * tariffRate) / 100).toFixed(2));
  return {
    start: block.start,
    end: block.end,
    charge_in_kwh: Number(block.charge_in_kwh ?? -charged),
    charged_kwh: charged,
    cost,
    source: block.source || 'completed-dispatch'
  };
}

function toIsoDateOnly(value) {
  if (!value) return value;
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
}

function addDaysToIsoDate(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function getSessionWindowStrings(session) {
  const dateOnly = toIsoDateOnly(session.date);
  const start = `${dateOnly} ${session.startTime}:00`;
  const isOvernight = session.endTime <= session.startTime;
  const endDate = isOvernight ? addDaysToIsoDate(dateOnly, 1) : dateOnly;
  const end = `${endDate} ${session.endTime}:00`;
  return { start, end };
}

function mergeSessionBlocks(existingSession, incomingSession, tariffRate, gapMinutes) {
  const existingBlocks = Array.isArray(existingSession.dispatch_blocks) ? existingSession.dispatch_blocks : [];
  const incomingBlocks = Array.isArray(incomingSession.dispatchBlocks) ? incomingSession.dispatchBlocks : [];
  const allBlocks = [...existingBlocks, ...incomingBlocks]
    .map((block) => normalizeBlock(block, tariffRate))
    .filter((block) => block.start && block.end);

  const dedupMap = new Map();
  for (const block of allBlocks) {
    dedupMap.set(`${block.start}|${block.end}`, block);
  }

  const uniqueBlocks = [...dedupMap.values()].sort((a, b) => new Date(a.start) - new Date(b.start));
  if (!uniqueBlocks.length) return null;

  const mergedGroups = [];
  for (const block of uniqueBlocks) {
    const current = mergedGroups[mergedGroups.length - 1];
    const start = new Date(block.start);
    const end = new Date(block.end);
    if (!current) {
      mergedGroups.push({ start, end, blocks: [block] });
      continue;
    }
    const gapMs = start - current.end;
    if (gapMs <= gapMinutes * 60 * 1000) {
      current.end = end > current.end ? end : current.end;
      current.blocks.push(block);
    } else {
      mergedGroups.push({ start, end, blocks: [block] });
    }
  }

  const incomingStart = new Date(`${incomingSession.date}T${incomingSession.startTime}:00`);
  const incomingEnd = new Date(`${incomingSession.date}T${incomingSession.endTime}:00`);
  if (incomingEnd <= incomingStart) {
    incomingEnd.setDate(incomingEnd.getDate() + 1);
  }
  const targetGroup = mergedGroups.find((group) =>
    group.start <= incomingEnd && group.end >= incomingStart
  ) || mergedGroups[0];

  if (!targetGroup) return null;

  const totalKwh = targetGroup.blocks.reduce((sum, block) => sum + (parseFloat(block.charged_kwh) || 0), 0);
  const totalCost = targetGroup.blocks.reduce((sum, block) => sum + (parseFloat(block.cost) || 0), 0);
  const startDate = targetGroup.start;
  const endDate = targetGroup.end;

  return {
    date: formatUkDate(startDate),
    startTime: formatUkTime(startDate),
    endTime: formatUkTime(endDate),
    energyAdded: parseFloat(totalKwh.toFixed(3)),
    cost: parseFloat(totalCost.toFixed(2)),
    dispatchCount: targetGroup.blocks.length,
    dispatchBlocks: targetGroup.blocks,
    octopusSessionId: `${startDate.toISOString()}_${endDate.toISOString()}_${targetGroup.blocks.length}`
  };
}

async function importDailyCharges() {
  console.log('=== Daily Charge Import Started ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  // Validate environment variables
  const requiredEnvVars = ['DATABASE_URL', 'OCTOPUS_API_KEY', 'OCTOPUS_MPAN', 'OCTOPUS_SERIAL', 'OCTOPUS_ACCOUNT_NUMBER'];
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
      process.env.OCTOPUS_SERIAL,
      {
        accountNumber: process.env.OCTOPUS_ACCOUNT_NUMBER || null,
        graphqlToken: process.env.OCTOPUS_GRAPHQL_TOKEN || null
      }
    );
    console.log('✅ Octopus client initialized');
    
    // Calculate date range (last 3 days to handle completedDispatches lag safely)
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 3);
    
    console.log(`📅 Importing from ${dateFrom.toISOString()} to ${dateTo.toISOString()}`);
    
    const result = await octopusClient.importSessionsFromCompletedDispatches({
      dateFrom: dateFrom.toISOString().split('T')[0],
      dateTo: dateTo.toISOString().split('T')[0],
      tariffRate: octopusClient.getIntelligentOctopusChargingRate(),
      gapMinutes: 240,
      accountNumber: process.env.OCTOPUS_ACCOUNT_NUMBER || undefined,
      vehicle: process.env.DEFAULT_VEHICLE || null
    });
    
    console.log('\n=== Import Results ===');
    console.log(`✅ Sessions detected: ${result.length}`);
    
    // Insert sessions into database
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const errorSamples = [];
    
    for (const session of result) {
      try {
        const gapMinutes = 240;
        const { start: incomingStartTs, end: incomingEndTs } = getSessionWindowStrings(session);
        const existingResult = await pool.query(
          `SELECT * FROM charging_sessions
           WHERE source LIKE 'octopus%'
             AND (CAST(CAST(date AS date)::text || ' ' || start_time::text AS timestamp) <= $2::timestamp + ($3::text || ' minutes')::interval)
             AND (
               CASE
                 WHEN end_time < start_time THEN CAST(CAST(date AS date)::text || ' ' || end_time::text AS timestamp) + interval '1 day'
                 ELSE CAST(CAST(date AS date)::text || ' ' || end_time::text AS timestamp)
               END
             ) >= $1::timestamp - ($3::text || ' minutes')::interval
           ORDER BY date DESC, start_time DESC
          `,
          [incomingStartTs, incomingEndTs, gapMinutes]
        );

        if (existingResult.rows.length > 0) {
          let merged = { ...session };
          for (const existing of existingResult.rows) {
            const nextMerged = mergeSessionBlocks(existing, merged, session.tariffRate, gapMinutes);
            if (nextMerged) {
              merged = { ...merged, ...nextMerged };
            }
          }
          if (merged) {
            const keepRow = existingResult.rows[0];
            await pool.query(
              `UPDATE charging_sessions
               SET date = $1,
                   start_time = $2,
                   end_time = $3,
                   energy_added = $4,
                   tariff_rate = $5,
                   cost = $6,
                   source = $7,
                   vehicle = $8,
                   octopus_session_id = $9,
                   dispatch_count = $10,
                   dispatch_blocks = $11
               WHERE id = $12`,
              [
                merged.date,
                merged.startTime,
                merged.endTime,
                merged.energyAdded,
                session.tariffRate,
                merged.cost,
                'octopus-graphql',
                keepRow.vehicle || session.vehicle || null,
                merged.octopusSessionId,
                merged.dispatchCount,
                JSON.stringify(merged.dispatchBlocks),
                keepRow.id
              ]
            );
            const extraIds = existingResult.rows
              .map((row) => row.id)
              .filter((id) => id !== keepRow.id);
            if (extraIds.length > 0) {
              await pool.query(
                `DELETE FROM charging_sessions WHERE id = ANY($1::text[])`,
                [extraIds]
              );
            }
            updated++;
            console.log(`  ♻️  Updated: ${merged.date} ${merged.startTime} - ${merged.energyAdded} kWh`);
            continue;
          }
        }

        // Generate unique ID using timestamp + random suffix to prevent collisions
        const id = Date.now().toString() + '-' + Math.random().toString(36).slice(2, 11);
        
        const query = `
          INSERT INTO charging_sessions (
            id, date, start_time, end_time, energy_added, start_soc, end_soc, 
            tariff_rate, cost, notes, source, vehicle, octopus_session_id, dispatch_count, dispatch_blocks
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
          session.source || 'octopus-graphql',
          session.vehicle || null,
          session.octopusSessionId,
          session.dispatchCount || null,
          session.dispatchBlocks ? JSON.stringify(session.dispatchBlocks) : null
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
          errors++;
          const errorSummary = `${error.code || 'NO_CODE'}: ${error.message}`;
          errorSamples.push(errorSummary);
          console.error(`  ❌ Error importing session: ${errorSummary}`);
          if (error.detail) {
            console.error(`     detail: ${error.detail}`);
          }
          if (error.hint) {
            console.error(`     hint: ${error.hint}`);
          }
        }
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`✅ Successfully imported (new): ${imported} sessions`);
    console.log(`♻️  Updated existing: ${updated} sessions`);
    console.log(`⏭️  Skipped (duplicates): ${skipped} sessions`);
    console.log(`❌ Errors: ${errors}`);
    if (errorSamples.length > 0) {
      console.log(`❌ Error samples: ${errorSamples.slice(0, 3).join(' | ')}`);
    }
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
          updated: updated,
          total_detected: result.length,
          skipped: skipped
        })]
      );
      console.log('✅ Last import info stored in database');
    } catch (error) {
      console.error('⚠️  Warning: Could not store last import info:', error.message);
    }
    
    console.log('=== Daily Charge Import Completed ===\n');

    if (errors > 0) {
      throw new Error(`Import completed with ${errors} non-duplicate error(s)`);
    }
    
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

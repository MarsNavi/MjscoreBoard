import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Values from .env
const SUPABASE_URL = 'https://hdifaxnyercevaiulpgr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkaWZheG55ZXJjZXZhaXVscGdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNzEzMDAsImV4cCI6MjA3ODk0NzMwMH0.N_MdYGKz4MB62SKTr0krG-Mb-rz6hWAzl9RiEuymkFw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchAllData() {
  console.log('Starting data download...');
  
  const tables = ['users', 'games', 'players', 'scores', 'penalties', 'game_results'];
  const dbData = {};

  for (const table of tables) {
    console.log(`Fetching ${table}...`);
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.error(`Error fetching ${table}:`, error);
    } else {
      console.log(`Fetched ${data.length} records from ${table}`);
      dbData[table] = data;
    }
  }

  // Also fetch game_results view if needed, but it's likely a view derived from others.
  // The codebase uses 'game_results' in HomePage.tsx. 
  // Let's see if we can fetch it, or if we should reconstruct it.
  // 'game_results' is likely a view. We can fetch it to be safe, or just rely on raw tables.
  // The code uses: supabase.from('game_results').select('player_name, game_id, games!inner(creator_id)')
  // We can fetch it.
  
  // Actually, for local DB, we should probably just store the raw tables and recreate views if needed.
  // But let's grab it just in case.
  /*
  console.log('Fetching game_results...');
  const { data: results, error: resError } = await supabase.from('game_results').select('*');
  if (!resError) {
      dbData['game_results'] = results;
  }
  */

  const outputPath = path.join(process.cwd(), 'src/data/initial_db.json');
  fs.writeFileSync(outputPath, JSON.stringify(dbData, null, 2));
  console.log(`Data saved to ${outputPath}`);
}

fetchAllData();

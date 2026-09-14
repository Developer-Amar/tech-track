import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(filePath: string): void {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (err) {
    console.error('Failed to load env file:', err);
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JUDGE0_URL = process.env.JUDGE0_API_URL!;
const JUDGE0_KEY = process.env.JUDGE0_API_KEY!;

async function main() {
  console.log('\n======================================================');
  console.log('  TECH TREK 2.0 -- FULL SYSTEM VERIFICATION SUITE');
  console.log('======================================================\n');

  console.log('1. ENVIRONMENT CONFIGURATION');
  console.log('  Supabase URL:     ', SUPABASE_URL);
  console.log('  Supabase Anon:    ', SUPABASE_ANON ? '[OK] Present (' + SUPABASE_ANON.slice(0, 15) + '...)' : '[FAIL] Missing');
  console.log('  Supabase Service: ', SUPABASE_SERVICE ? '[OK] Present (' + SUPABASE_SERVICE.slice(0, 15) + '...)' : '[FAIL] Missing');
  console.log('  Judge0 URL:       ', JUDGE0_URL);
  console.log('  Judge0 Key:       ', JUDGE0_KEY ? '[OK] Present (' + JUDGE0_KEY.slice(0, 10) + '...)' : '[FAIL] Missing');

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  console.log('\n2. DATABASE TABLES AUDIT');
  const tables = [
    'users',
    'units',
    'unit_members',
    'checkpoints',
    'riddles',
    'coding_questions',
    'test_cases',
    'submissions',
    'round_progress',
    'proctoring_state',
    'proctoring_events',
    'announcements',
    'notifications',
    'audit_log',
    'event_settings',
    'blocked_emails',
    'heartbeat_log',
    'unit_checkpoint_codes'
  ];

  for (const table of tables) {
    const { data, count, error } = await adminClient
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) {
      console.log('  [FAIL] Table [' + table + ']: ERROR -> ' + error.message);
    } else {
      console.log('  [PASS] Table [' + table + ']: ACTIVE (Rows: ' + (count ?? 0) + ')');
    }
  }

  console.log('\n3. DATABASE VIEWS AUDIT');
  const views = ['leaderboard_view', 'admin_unit_overview'];
  for (const view of views) {
    const { data, error } = await adminClient.from(view).select('*').limit(1);
    if (error) {
      console.log('  [FAIL] View [' + view + ']: ERROR -> ' + error.message);
    } else {
      console.log('  [PASS] View [' + view + ']: ACTIVE & ACCESSIBLE');
    }
  }

  console.log('\n4. CORE SYSTEM STATE');
  const { data: settings } = await adminClient.from('event_settings').select('*').single();
  console.log('  Event Settings:   ', JSON.stringify(settings));

  const { data: usersList } = await adminClient.from('users').select('id, role, profile_completed, pass_code');
  console.log('  Users in DB:       ' + (usersList?.length ?? 0));
  const byRole = new Map<string, number>();
  let completed = 0;
  let withPassCode = 0;
  for (const u of usersList ?? []) {
    byRole.set(u.role, (byRole.get(u.role) ?? 0) + 1);
    if (u.profile_completed) completed++;
    if (u.pass_code) withPassCode++;
  }
  for (const [role, count] of byRole.entries()) {
    console.log(`    - [${role}]: ${count}`);
  }
  console.log(`  Completed profiles: ${completed}`);
  console.log(`  Pass codes issued:  ${withPassCode}`);

  console.log('\n4b. PROCTORING DIAGNOSTICS');
  const { data: pEvents } = await adminClient.from('proctoring_events').select('*');
  console.log(`  proctoring_events count: ${pEvents?.length ?? 0}`);
  pEvents?.forEach((e, idx) => console.log(`    [${idx+1}] unit: ${e.unit_id} | checkpoint: ${e.checkpoint_id} | type: ${e.event_type} | at: ${e.occurred_at}`));

  const { data: pStates } = await adminClient.from('proctoring_state').select('*');
  console.log(`  proctoring_state count: ${pStates?.length ?? 0}`);
  pStates?.forEach((s, idx) => console.log(`    [${idx+1}] unit: ${s.unit_id} | strikes: ${s.tab_switches}/${s.tab_switch_limit} | locked: ${s.locked_out}`));


  console.log('\n5. JUDGE0 MULTI-LANGUAGE TEST MATRIX');
  const testMatrix = [
    { lang: 'Python', id: 71, source: 'print("OK_PY")', expected: 'OK_PY' },
    { lang: 'C', id: 50, source: '#include <stdio.h>\nint main(){ printf("OK_C"); return 0; }', expected: 'OK_C' },
    { lang: 'C++', id: 54, source: '#include <iostream>\nint main(){ std::cout << "OK_CPP"; return 0; }', expected: 'OK_CPP' },
    { lang: 'Java', id: 62, source: 'public class Main { public static void main(String[] args) { System.out.print("OK_JAVA"); } }', expected: 'OK_JAVA' }
  ];

  for (const test of testMatrix) {
    try {
      const createRes = await fetch(JUDGE0_URL.replace(/\/+$/, '') + '/submissions?base64_encoded=false&wait=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-host': new URL(JUDGE0_URL).host,
          'x-rapidapi-key': JUDGE0_KEY
        },
        body: JSON.stringify({
          source_code: test.source,
          language_id: test.id,
          stdin: ''
        })
      });

      if (!createRes.ok) {
        console.log('  [FAIL] [' + test.lang + ']: HTTP ' + createRes.status + ' -> ' + (await createRes.text()));
        continue;
      }

      const resJson = await createRes.json();
      const stdout = (resJson.stdout || '').trim();
      const statusDesc = resJson.status?.description;

      if (statusDesc === 'Accepted' && stdout === test.expected) {
        console.log('  [PASS] [' + test.lang + ']: ACCEPTED (Time: ' + resJson.time + 's, Mem: ' + resJson.memory + 'KB)');
      } else {
        console.log('  [FAIL] [' + test.lang + ']: Status: ' + statusDesc + ', Stdout: "' + stdout + '" (Expected: "' + test.expected + '")');
      }
    } catch (err: any) {
      console.log('  [FAIL] [' + test.lang + ']: Connection Exception -> ' + err.message);
    }
  }

  console.log('\n======================================================');
  console.log('  VERIFICATION COMPLETE');
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});

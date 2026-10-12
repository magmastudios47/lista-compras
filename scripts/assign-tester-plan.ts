import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Cargar variables de entorno de .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length > 0) {
      process.env[key.trim()] = rest.join('=').trim();
    }
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function parseArgs() {
  const args = process.argv.slice(2);
  const options: {
    householdId: string | null;
    email: string | null;
  } = {
    householdId: null,
    email: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--household-id' && args[i + 1]) {
      options.householdId = args[++i];
    } else if (arg === '--email' && args[i + 1]) {
      options.email = args[++i];
    }
  }

  return options;
}

async function main() {
  const { householdId, email } = parseArgs();

  if (!householdId && !email) {
    console.log('Uso: npx tsx scripts/assign-tester-plan.ts --household-id <UUID> | --email <EMAIL>');
    process.exit(1);
  }

  console.log('\n=======================================================');
  console.log('      ASIGNAR PLAN TESTER INTERNO - LISTA COMPARS       ');
  console.log('=======================================================');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('[AVISO] No se detectó SUPABASE_SERVICE_ROLE_KEY en el entorno.');
    console.log('Podés asignarlo manualmente en Supabase SQL Editor con:');
    if (householdId) {
      console.log(`
INSERT INTO public.licenses (household_id, plan_id, status, valid_until)
VALUES ('${householdId}', 'tester', 'active', NULL)
ON CONFLICT (household_id) DO UPDATE SET plan_id = 'tester', status = 'active', valid_until = NULL;

UPDATE public.households SET monthly_chef_limit = 9999 WHERE id = '${householdId}';
      `);
    } else {
      console.log(`
-- Busca el household_id por email y ejecuta:
INSERT INTO public.licenses (household_id, plan_id, status, valid_until)
SELECT hm.household_id, 'tester', 'active', NULL
FROM public.household_members hm
JOIN auth.users u ON u.id = hm.user_id
WHERE u.email = '${email}'
LIMIT 1
ON CONFLICT (household_id) DO UPDATE SET plan_id = 'tester', status = 'active', valid_until = NULL;
      `);
    }
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  let targetHouseholdId = householdId;

  if (!targetHouseholdId && email) {
    // Buscar usuario por email en auth.users
    const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
    if (userErr) {
      console.error('Error buscando usuarios:', userErr.message);
      process.exit(1);
    }
    const foundUser = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!foundUser) {
      console.error(`No se encontró ningún usuario con email ${email}`);
      process.exit(1);
    }

    const { data: member, error: mErr } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', foundUser.id)
      .limit(1)
      .maybeSingle();

    if (mErr || !member) {
      console.error('El usuario no pertenece a ningún hogar.');
      process.exit(1);
    }

    targetHouseholdId = member.household_id;
  }

  // Asignar licencia tester
  const { error: licErr } = await supabase
    .from('licenses')
    .upsert({
      household_id: targetHouseholdId,
      plan_id: 'tester',
      status: 'active',
      valid_until: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'household_id' });

  if (licErr) {
    console.error('Error asignando licencia tester:', licErr.message);
    process.exit(1);
  }

  // Aumentar límite de consultas del hogar
  await supabase
    .from('households')
    .update({ monthly_chef_limit: 9999 })
    .eq('id', targetHouseholdId);

  console.log(`[ÉXITO] ¡Hogar ${targetHouseholdId} actualizado a Plan TESTER!`);
  console.log('Límite de consultas asignado: 9999 consultas/mes.');
  console.log('Integrantes máximos: 99.');
  console.log('=======================================================\n');
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});

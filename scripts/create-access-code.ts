import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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
    plan: string;
    uses: number;
    days: number | null;
    code: string | null;
    notes: string | null;
  } = {
    plan: 'base',
    uses: 1,
    days: null,
    code: null,
    notes: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--plan' && args[i + 1]) {
      options.plan = args[++i].toLowerCase();
    } else if (arg === '--uses' && args[i + 1]) {
      options.uses = parseInt(args[++i], 10);
    } else if (arg === '--days' && args[i + 1]) {
      options.days = parseInt(args[++i], 10);
    } else if (arg === '--code' && args[i + 1]) {
      options.code = args[++i].toUpperCase();
    } else if (arg === '--notes' && args[i + 1]) {
      options.notes = args[++i];
    }
  }

  return options;
}

function generateReadableCode(plan: string): string {
  const prefix = plan === 'premium' ? 'COMPARS-PREM' : (plan === 'tester' ? 'COMPARS-TEST' : 'COMPARS-BASE');
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Sin 0, 1, I, O para evitar confusiones
  let randomPart = '';
  const randomBytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    randomPart += chars[randomBytes[i] % chars.length];
  }
  return `${prefix}-${randomPart}`;
}

export function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

async function main() {
  const options = parseArgs();

  if (!['base', 'premium', 'tester'].includes(options.plan)) {
    console.error('Error: Plan inválido. Opciones permitidas: base, premium, tester.');
    process.exit(1);
  }

  const rawCode = options.code || generateReadableCode(options.plan);
  const codeHash = hashCode(rawCode);

  let expiresAt: string | null = null;
  if (options.days && options.days > 0) {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + options.days);
    expiresAt = expDate.toISOString();
  }

  console.log('\n=======================================================');
  console.log('       GENERADOR DE CÓDIGOS DE ACCESO - LISTA COMPARS    ');
  console.log('=======================================================');
  console.log(`Plan:          ${options.plan.toUpperCase()}`);
  console.log(`Código:        ${rawCode}`);
  console.log(`Usos máximos:  ${options.uses}`);
  console.log(`Vencimiento:   ${expiresAt ? `${options.days} días (${expiresAt.split('T')[0]})` : 'Sin vencimiento (de por vida)'}`);
  console.log(`Hash SHA-256:  ${codeHash}`);
  if (options.notes) console.log(`Notas:         ${options.notes}`);

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('\n[AVISO] No se detectó SUPABASE_SERVICE_ROLE_KEY en el entorno.');
    console.log('Podés insertar este código manualmente con el siguiente SQL:');
    console.log(`
INSERT INTO public.access_codes (code_hash, plan_id, max_uses, expires_at, notes)
VALUES ('${codeHash}', '${options.plan}', ${options.uses}, ${expiresAt ? `'${expiresAt}'` : 'NULL'}, ${options.notes ? `'${options.notes}'` : 'NULL'});
    `);
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase
    .from('access_codes')
    .insert({
      code_hash: codeHash,
      plan_id: options.plan,
      max_uses: options.uses,
      expires_at: expiresAt,
      notes: options.notes,
    })
    .select()
    .single();

  if (error) {
    console.error('\nError al registrar el código en Supabase:', error.message);
    process.exit(1);
  }

  console.log('\n[ÉXITO] ¡Código guardado en base de datos correctamente!');
  console.log(`ID en DB: ${data.id}`);
  console.log('Compartí este código con el usuario:');
  console.log(`===> ${rawCode} <===`);
  console.log('=======================================================\n');
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('create-access-code')) {
  main().catch((err) => {
    console.error('Error fatal:', err);
    process.exit(1);
  });
}

import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
let apiKey = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('GEMINI_API_KEY=')) {
      apiKey = trimmed.split('=')[1].trim();
    }
  }
}

async function listModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  if (data.models) {
    console.log('Available models for key:');
    for (const m of data.models) {
      if (m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent')) {
        console.log(`- ${m.name} (${m.displayName})`);
      }
    }
  } else {
    console.log('Response:', data);
  }
}

listModels();

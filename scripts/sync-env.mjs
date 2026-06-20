import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { config as loadDotEnv } from 'dotenv';

const mode = process.argv[2] === 'production' ? 'production' : 'development';
const projectRoot = process.cwd();
const environmentDir = path.join(projectRoot, 'src', 'environments');

const filesToLoad = [
  '.env',
  '.env.local',
  mode === 'production' ? '.env.production' : '.env.development',
  mode === 'production' ? '.env.production.local' : '.env.development.local'
].filter(Boolean);

for (const fileName of filesToLoad) {
  const filePath = path.join(projectRoot, fileName);

  if (fs.existsSync(filePath)) {
    loadDotEnv({ path: filePath, override: true });
  }
}

const appName = process.env.APP_NAME ?? 'Food Tracker';
const supabaseUrl = process.env.SUPABASE_URL ?? 'https://your-project-ref.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? 'your-anon-key';

const renderEnvironmentFile = (production) => `export const environment = {
  production: ${production},
  supabaseUrl: ${JSON.stringify(supabaseUrl)},
  supabaseAnonKey: ${JSON.stringify(supabaseAnonKey)},
  appName: ${JSON.stringify(appName)}
};
`;

fs.mkdirSync(environmentDir, { recursive: true });

fs.writeFileSync(
  path.join(environmentDir, 'environment.ts'),
  renderEnvironmentFile(false),
  'utf8'
);

fs.writeFileSync(
  path.join(environmentDir, 'environment.prod.ts'),
  renderEnvironmentFile(true),
  'utf8'
);

console.log(`Synchronized Angular environment files from .env sources for ${mode}.`);

/**
 * Master data generation script
 * Runs all individual generation scripts
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';


const tsScripts = [
  'generate-mocks.ts',
  'generate-tasks.ts',
  'generate-domains.ts',
];

const mjsScripts = [
  'generate-trajectory.mjs',
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.log('🚀 Generating all site data...\n');

for (const script of tsScripts) {
  const scriptPath = path.resolve(__dirname, script);
  console.log(`📝 Running ${script}...`);
  try {
    execSync(`npx ts-node --esm "${scriptPath}"`, { stdio: 'inherit' });
    console.log(`✅ ${script} completed\n`);
  } catch (error) {
    console.warn(`⚠️  ${script} failed, skipping...`);
    console.warn(`   Error: ${(error as Error).message}\n`);
  }
}

for (const script of mjsScripts) {
  const scriptPath = path.resolve(__dirname, script);
  console.log(`📝 Running ${script}...`);
  try {
    execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
    console.log(`✅ ${script} completed\n`);
  } catch (error) {
    console.warn(`⚠️  ${script} failed, skipping...`);
    console.warn(`   Error: ${(error as Error).message}\n`);
  }
}

console.log('🎉 Data generation complete!');

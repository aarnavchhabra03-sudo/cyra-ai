import { runComprehensiveTests } from '../src/tests/comprehensive-architecture.test';

async function run() {
  const result = await runComprehensiveTests();
  process.exit(result ? 0 : 1);
}

run().catch((err) => {
  console.error('Test execution exception:', err);
  process.exit(1);
});

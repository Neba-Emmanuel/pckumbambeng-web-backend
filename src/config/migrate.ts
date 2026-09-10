import fs from 'fs';
import path from 'path';
import { pool } from './database';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

async function ensureMigrationsTable(): Promise<void> {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getExecutedMigrations(): Promise<string[]> {
  const [rows] = await pool.execute<any[]>(
    'SELECT filename FROM _migrations ORDER BY id ASC'
  );
  return rows.map((row: { filename: string }) => row.filename);
}

async function getMigrationFiles(): Promise<string[]> {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('No migrations directory found.');
    return [];
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  return files;
}

async function runMigration(filename: string): Promise<void> {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filepath, 'utf-8');

  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const statement of statements) {
      await connection.execute(statement);
    }

    await connection.execute(
      'INSERT INTO _migrations (filename) VALUES (?)',
      [filename]
    );

    await connection.commit();
    console.log(`  ✓ ${filename}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function migrate(): Promise<void> {
  console.log('Running database migrations...\n');

  await ensureMigrationsTable();

  const executed = await getExecutedMigrations();
  const allFiles = await getMigrationFiles();
  const pending = allFiles.filter((f) => !executed.includes(f));

  if (pending.length === 0) {
    console.log('No pending migrations.');
    return;
  }

  console.log(`Found ${pending.length} pending migration(s):\n`);

  for (const file of pending) {
    await runMigration(file);
  }

  console.log('\nAll migrations completed.');
}

// Run migrations when executed directly
if (require.main === module) {
  migrate()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

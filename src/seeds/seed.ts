import bcrypt from 'bcrypt';
import { pool } from '../config/database';

const BCRYPT_COST_FACTOR = 10;

interface SeedAdmin {
  name: string;
  email: string;
  password: string;
  role: string;
}

interface SeedFacebookSource {
  page_id: string;
  page_name: string;
  access_token: string;
  is_active: boolean;
}

const defaultAdmin: SeedAdmin = {
  name: 'Admin',
  email: 'admin@pckumbambeng.org',
  password: 'Admin@123',
  role: 'administrator',
};

const facebookSources: SeedFacebookSource[] = [
  {
    page_id: 'CBS_BUEA_PAGE_ID',
    page_name: 'CBS Buea',
    access_token: 'PLACEHOLDER_TOKEN',
    is_active: true,
  },
  {
    page_id: 'CBS_BAMENDA_PAGE_ID',
    page_name: 'CBS Bamenda',
    access_token: 'PLACEHOLDER_TOKEN',
    is_active: true,
  },
];

async function seedAdmin(): Promise<void> {
  console.log('Seeding default administrator...');

  const [existing] = await pool.execute<any[]>(
    'SELECT id FROM members WHERE email = ?',
    [defaultAdmin.email]
  );

  if (existing.length > 0) {
    console.log('  ✓ Admin account already exists, skipping.');
    return;
  }

  const passwordHash = await bcrypt.hash(defaultAdmin.password, BCRYPT_COST_FACTOR);

  await pool.execute(
    'INSERT INTO members (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [defaultAdmin.name, defaultAdmin.email, passwordHash, defaultAdmin.role]
  );

  console.log('  ✓ Admin account created (admin@pckumbambeng.org)');
}

async function seedFacebookSources(): Promise<void> {
  console.log('Seeding Facebook page sources...');

  for (const source of facebookSources) {
    const [existing] = await pool.execute<any[]>(
      'SELECT id FROM facebook_page_sources WHERE page_name = ?',
      [source.page_name]
    );

    if (existing.length > 0) {
      console.log(`  ✓ "${source.page_name}" already exists, skipping.`);
      continue;
    }

    await pool.execute(
      'INSERT INTO facebook_page_sources (page_id, page_name, access_token, is_active) VALUES (?, ?, ?, ?)',
      [source.page_id, source.page_name, source.access_token, source.is_active]
    );

    console.log(`  ✓ "${source.page_name}" created.`);
  }
}

async function seed(): Promise<void> {
  console.log('Running database seed...\n');

  try {
    await seedAdmin();
    await seedFacebookSources();
    console.log('\nSeed completed successfully.');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run seed when executed directly
if (require.main === module) {
  seed().then(() => process.exit(0));
}

export { seed };

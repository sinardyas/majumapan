import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { stores } from './schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos';

async function setup() {
  console.log('========================================');
  console.log('       Database Setup Starting');
  console.log('========================================\n');

  // Step 1: Run migrations
  console.log('[Step 1/2] Running migrations...');
  const migrationClient = postgres(connectionString, { max: 1 });
  const migrationDb = drizzle(migrationClient);
  
  try {
    await migrate(migrationDb, { migrationsFolder: './drizzle' });
    console.log('[Step 1/2] Migrations completed successfully!\n');
  } catch (error) {
    console.error('[Step 1/2] Migration failed:', error);
    await migrationClient.end();
    process.exit(1);
  }
  
  await migrationClient.end();

  // Step 2: Check if seeding is needed
  console.log('[Step 2/2] Checking if seeding is needed...');
  
  const seedClient = postgres(connectionString, { max: 1 });
  const seedDb = drizzle(seedClient);
  
  try {
    const existingStores = await seedDb.select().from(stores).limit(1);

    if (existingStores.length > 0) {
      console.log('[Step 2/2] Database already has data. Skipping seed.\n');
      console.log('========================================');
      console.log('       Database Setup Complete');
      console.log('========================================');
      console.log('Note: To force re-seed, manually clear the database first.\n');
      await seedClient.end();
      process.exit(0);
    }

    // Run seeding by importing the seed module
    console.log('[Step 2/2] No existing data found. Running seed...\n');
    await seedClient.end();
    
    // Import and execute seed (seed.ts has its own db connection and process.exit)
    await import('./seed');
    
  } catch (error) {
    console.error('[Step 2/2] Seed check failed:', error);
    await seedClient.end();
    process.exit(1);
  }
}

setup().catch((err) => {
  console.error('Setup failed!', err);
  process.exit(1);
});

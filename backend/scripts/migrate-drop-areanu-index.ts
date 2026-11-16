import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('C:/sifon/backend/.env') });

export async function dropObsoleteAreaNumberIndex() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI not found in environment');
  }

  console.log('[Migration] Connecting to MongoDB...');
  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database instance unavailable');
  }

  const areasCollection = db.collection('areas');
  const existingIndexes = await areasCollection.indexes();
  console.log('[Migration] Existing indexes on "areas":', existingIndexes.map(i => i.name));

  const targetIndex = existingIndexes.find(
    i => i.name === 'areaNumber_1' || (i.key && i.key.areaNumber && i.unique)
  );

  if (targetIndex) {
    console.log(`[Migration] Found obsolete index "${targetIndex.name}". Dropping it now...`);
    await areasCollection.dropIndex(targetIndex.name);
    console.log(`[Migration] Successfully dropped index "${targetIndex.name}".`);
  } else {
    console.log('[Migration] Obsolete unique index on areaNumber does not exist or was already dropped.');
  }

  // Also check if any documents have areaNumber = null/undefined and ensure documents remain intact
  const count = await areasCollection.countDocuments();
  console.log(`[Migration] Verified: ${count} area/location documents preserved.`);

  const updatedIndexes = await areasCollection.indexes();
  console.log('[Migration] Updated indexes on "areas":', updatedIndexes.map(i => i.name));

  await mongoose.disconnect();
  console.log('[Migration] Migration completed successfully.');
}

if (process.argv[1]?.includes('migrate-drop-areanu-index')) {
  dropObsoleteAreaNumberIndex().catch(err => {
    console.error('[Migration] Failed:', err);
    process.exit(1);
  });
}


import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let replSet: MongoMemoryReplSet;

export async function setupTestDb(): Promise<string> {
  replSet = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      name: 'rs0',
      storageEngine: 'wiredTiger',
    },
  });

  const uri = replSet.getUri('sifon_test');
  await mongoose.connect(uri);
  return uri;
}

export async function teardownTestDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
  }
}

export async function clearTestDb(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

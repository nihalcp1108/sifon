import { MongoMemoryReplSet } from 'mongodb-memory-server';

async function startLocalMongo() {
  console.log('[MongoReplSet] Initializing local MongoDB replica set...');
  try {
    const replSet = await MongoMemoryReplSet.create({
      replSet: {
        count: 1,
        name: 'rs0',
        storageEngine: 'wiredTiger',
      },
      instanceOpts: [
        {
          port: 27017,
        },
      ],
    });

    const uri = replSet.getUri('sifon');
    console.log('\n======================================================');
    console.log(`[MongoReplSet] Replica set is READY and RUNNING!`);
    console.log(`[MongoReplSet] Connection URI: ${uri}`);
    console.log('======================================================\n');
    console.log('Keep this terminal open while developing locally.\n');

    process.on('SIGINT', async () => {
      console.log('\nStopping replica set...');
      await replSet.stop();
      process.exit(0);
    });
  } catch (error: any) {
    if (error.message?.includes('Address already in use') || error.code === 'EADDRINUSE') {
      console.log('[MongoReplSet] Port 27017 is already in use by an existing MongoDB instance or replica set.');
    } else {
      console.error('[MongoReplSet] Error starting replica set:', error);
    }
  }
}

startLocalMongo();

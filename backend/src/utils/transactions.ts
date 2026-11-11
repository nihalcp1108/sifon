import mongoose, { ClientSession } from 'mongoose';

export async function runInTransaction<T>(
  fn: (session: ClientSession) => Promise<T>,
  existingSession?: ClientSession
): Promise<T> {
  if (existingSession) {
    return await fn(existingSession);
  }

  const session = await mongoose.startSession();
  const maxRetries = 5;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      session.startTransaction({
        readPreference: 'primary',
        readConcern: { level: 'local' },
        writeConcern: { w: 'majority' },
      });

      const result = await fn(session);

      // Commit transaction with bounded retry if UnknownTransactionCommitResult
      while (true) {
        try {
          await session.commitTransaction();
          break;
        } catch (commitError: any) {
          if (commitError.hasErrorLabel && commitError.hasErrorLabel('UnknownTransactionCommitResult')) {
            continue;
          }
          throw commitError;
        }
      }

      await session.endSession();
      return result;
    } catch (error: any) {
      if (session.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch (abortErr) {
          // ignore abort error if already aborted
        }
      }

      const isTransient = error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError');
      if (isTransient && attempt < maxRetries) {
        // Exponential backoff with random jitter to prevent lockstep collision
        const delay = Math.floor(Math.random() * 40) + attempt * 20;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      await session.endSession();
      throw error;
    }
  }

  await session.endSession();
  throw new Error('Transaction failed after maximum retries');
}

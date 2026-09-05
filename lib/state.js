import { db } from 'sdk';
import { eq } from 'sdk/db';
import { users } from 'schema';

export async function getUser(userId) {
  await db.insert(users)
    .values({ id: userId })
    .onConflictDoNothing({ target: users.id })
    .run();

  return db.select().from(users).where(eq(users.id, userId)).get();
}

export function parseStep(step) {
  if (!step) return null;

  try {
    return JSON.parse(step);
  } catch {
    return null;
  }
}

export async function setStep(userId, step = null) {
  await db.update(users)
    .set({ step: step === null ? null : JSON.stringify(step) })
    .where(eq(users.id, userId))
    .run();
}

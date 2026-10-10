'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { normalizeUniversityName } from '@/lib/university-name';

export async function updateUniversityName(value: string) {
  const user = await requireUser();
  if (typeof value !== 'string' || !value.trim() || value.length > 200)
    return { error: 'Enter a university name of up to 40 characters.' };
  const name = normalizeUniversityName(value);
  try {
    await db
      .update(users)
      .set({ universityName: name, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    revalidatePath('/', 'layout');
    return { name };
  } catch {
    return { error: 'Could not save your university name. Please try again.' };
  }
}

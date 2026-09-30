import 'server-only';
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/db';
import { users, accounts, authSessions, verificationTokens } from '@/db/schema';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { cache } from 'react';
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: authSessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: 'database', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    signIn({ account, profile }) {
      return (
        account?.provider === 'google' &&
        (profile as { email_verified?: boolean } | undefined)?.email_verified === true
      );
    },
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
export const requireUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
  if (!user) redirect('/login');
  return user;
});

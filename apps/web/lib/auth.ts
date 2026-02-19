import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
    ...(process.env.NODE_ENV === 'development'
      ? [
          Credentials({
            name: 'Dev Login',
            credentials: {
              email: { label: 'Email', type: 'email' },
            },
            async authorize(credentials) {
              const email = credentials?.email as string;
              if (!email) return null;
              return { id: email, email, name: email.split('@')[0] };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user }) {
      const allowedDomain = process.env.ALLOWED_DOMAIN;
      if (allowedDomain && user.email) {
        return user.email.endsWith(`@${allowedDomain}`);
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:4000'}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              avatar_url: (user as any).image || null,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            token.userId = data.data.id;
          }
        } catch (err) {
          console.error('Failed to sync user with API:', err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});

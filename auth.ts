import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
  },
  providers: [Google],
  callbacks: {
    session: async ({ session, user }) => {
      // The Prisma adapter returns the full row, but Auth.js's AdapterUser
      // type only knows the standard fields — cast to read our own column.
      const dbUser = user as typeof user & { profileComplete: boolean };
      session.user.id = dbUser.id;
      session.user.profileComplete = dbUser.profileComplete;
      return session;
    },
  },
});

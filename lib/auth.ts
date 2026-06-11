import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { classifyIdentifier, normalizeIdentifier, verifyOtp } from "@/lib/otp";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  // JWT sessions: required for the OTP credentials provider, and gives us
  // stateless tokens. NextAuth rotates the JWT on each request within maxAge.
  session: { strategy: "jwt", maxAge: 30 * 24 * 3600 },
  pages: { signIn: "/login" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID ?? "",
      clientSecret: process.env.APPLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      id: "otp",
      name: "OTP",
      credentials: {
        identifier: { label: "Email or +91 phone", type: "text" },
        code: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials.code) return null;
        const identifier = normalizeIdentifier(credentials.identifier);
        const channel = classifyIdentifier(identifier);
        if (!channel) return null;

        const valid = await verifyOtp(identifier, credentials.code);
        if (!valid) return null;

        const where = channel === "email" ? { email: identifier } : { phone: identifier };
        const user =
          (await prisma.user.findUnique({ where })) ??
          (await prisma.user.create({
            data:
              channel === "email"
                ? { email: identifier, emailVerified: new Date() }
                : { phone: identifier },
          }));

        return { id: user.id, email: user.email, name: user.name, image: user.image, plan: user.plan, phone: user.phone };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.plan = (user as { plan?: "FREE" | "PRO" }).plan ?? "FREE";
      }
      // Refresh the plan claim on session updates and periodically after
      // payment webhooks change it.
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({ where: { id: token.id }, select: { plan: true } });
        if (fresh) token.plan = fresh.plan;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.plan = token.plan ?? "FREE";
      }
      return session;
    },
  },
};

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

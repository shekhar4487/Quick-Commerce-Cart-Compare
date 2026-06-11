import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      plan: "FREE" | "PRO";
      phone?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    plan?: "FREE" | "PRO";
    phone?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    plan: "FREE" | "PRO";
  }
}

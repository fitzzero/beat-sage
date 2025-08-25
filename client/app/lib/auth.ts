import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    // Dev-only Credentials provider to expedite local/CI tests
    ...(process.env.ENABLE_DEV_CREDENTIALS === "true"
      ? [
          CredentialsProvider({
            name: "dev-credentials",
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
              action: { label: "Action", type: "hidden" }, // "signin" or "signup"
            },
            async authorize(credentials) {
              if (!credentials?.email) {
                return null;
              }

              const { email, action } = credentials;

              try {
                if (action === "signup") {
                  const existingUser = await prisma.user.findUnique({
                    where: { email },
                  });

                  if (existingUser) {
                    throw new Error("User already exists");
                  }
                  const newUser = await prisma.user.create({
                    data: {
                      email,
                      name: email.split("@")[0],
                      username: email.split("@")[0].toLowerCase(),
                    },
                  });
                  return {
                    id: newUser.id,
                    email: newUser.email,
                    name: newUser.name,
                    image: newUser.image ?? undefined,
                  };
                } else {
                  const user = await prisma.user.findUnique({
                    where: { email },
                  });

                  if (!user) {
                    throw new Error("No user found with this email");
                  }
                  return {
                    id: user.id,
                    email: user.email,
                    name: user.name ?? undefined,
                    image: user.image ?? undefined,
                  };
                }
              } catch {
                return null;
              }
            },
          }),
        ]
      : []),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  debug: process.env.NODE_ENV === "development",
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        // For OAuth providers (like Google), save user to database
        if (account?.provider === "google") {
          try {
            const existingUser = await prisma.user.findUnique({
              where: { email: user.email! },
            });
            if (!existingUser) {
              const newUser = await prisma.user.create({
                data: {
                  email: user.email!,
                  name: user.name || user.email!.split("@")[0],
                  username: user.email!.split("@")[0].toLowerCase(),
                  image: user.image,
                  emailVerified: new Date(),
                },
              });
              token.id = newUser.id;
            } else {
              token.id = existingUser.id;
            }
          } catch (_error) {
            // In production, you'd want to log this to a proper logging service
            // console.error("Error handling OAuth user:", error);
            return token;
          }
        } else {
          // For credentials provider, user.id is already set
          token.id = user.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};

export const getServerAuthSession = () => getServerSession(authOptions);

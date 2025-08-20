/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable strict mode for better development experience
  reactStrictMode: true,

  // Enable experimental features as needed
  experimental: {
    // typedRoutes: true, // Enable when stable
  },

  // Environment variables that should be exposed to the browser
  env: {
    CLIENT_PORT: process.env.CLIENT_PORT || "3000",
    SERVER_PORT: process.env.SERVER_PORT || "4000",
  },
};

module.exports = nextConfig;

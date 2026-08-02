/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    // Enables src/instrumentation.js, which boots the email scheduler.
    instrumentationHook: true,
    // These pull in native or dynamic requires that webpack cannot bundle; keep
    // them as real Node requires on the server. (Next 14 spelling.)
    serverComponentsExternalPackages: ['better-sqlite3', 'imapflow', 'mailparser', 'nodemailer'],
  },
  webpack: (config, { nextRuntime }) => {
    // Next compiles instrumentation.js for the edge runtime as well as node.
    // The email stack is Node-only (net sockets, streams, native sqlite), and
    // although the runtime guard in instrumentation.js stops it ever running
    // there, webpack still statically follows the dynamic import and fails to
    // resolve Node built-ins. Marking these external for edge keeps that
    // never-executed bundle from being built.
    if (nextRuntime === 'edge') {
      const nodeOnlyPackages = new Set([
        'better-sqlite3',
        'imapflow',
        'mailparser',
        'nodemailer',
        'node-cron',
        'juice',
      ]);

      config.externals = [
        ...(config.externals || []),
        ({ request }, callback) => {
          if (nodeOnlyPackages.has(request) || /^node:/.test(request)) {
            return callback(null, `commonjs ${request}`);
          }
          return callback();
        },
      ];
    }
    return config;
  },
};

module.exports = nextConfig;

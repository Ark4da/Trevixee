import type { NextConfig } from "next";
import path from "path";
import fs from "fs";
import { withSentryConfig } from "@sentry/nextjs";

// In git worktrees, node_modules lives in the main repo root, not the worktree.
// Walk up from __dirname until we find a directory with node_modules.
function findProjectRoot(dir: string): string {
  if (fs.existsSync(path.join(dir, "node_modules"))) return dir;
  const parent = path.dirname(dir);
  if (parent === dir) return dir;
  return findProjectRoot(parent);
}

const projectRoot = findProjectRoot(__dirname);

const nextConfig: NextConfig = {
  // Standalone output produces a minimal server bundle for Docker / Railway.
  // Skipped locally on Windows worktrees because symlinks fail without admin rights.
  output: process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined,
  serverExternalPackages: ["lightningcss", "lightningcss-win32-x64-msvc"],
  turbopack: {
    root: projectRoot,
  },
  images: {
    remotePatterns: [
      // Cloudinary uploads
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  widenClientFileUpload: true,
});

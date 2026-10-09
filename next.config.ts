import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: projectRoot,
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/dashboard/templates",
          destination: "/templates",
        },
        {
          source: "/agents/templates",
          destination: "/templates",
        },
      ],
      afterFiles: [
      {
        source: "/api/v1/agents/:agentId/settings",
        destination: "/api/v1/agents/settings/:agentId",
      },
      {
        source: "/api/v1/agents/:agentId/runs",
        destination: "/api/v1/agents/runs/:agentId",
      },
      {
        source: "/api/v1/agents/:agentId/run",
        destination: "/api/v1/agents/run/:agentId",
      },
      {
        source: "/api/v1/agents/:agentId/status",
        destination: "/api/v1/agents/status/:agentId",
      },
      {
        source: "/api/v1/agents/:agentId/schedules/trigger",
        destination: "/api/v1/agents/schedules/trigger/:agentId",
      },
      ],
    };
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

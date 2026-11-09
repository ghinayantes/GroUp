import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  regions: ["sin1"],
  schedules: {
    "agent-cleanup": {
      schedule: "0 2 * * *",
      timezone: "Asia/Jakarta",
      path: "/api/cron/cleanup",
      requestMethod: "GET",
    },
  },
};

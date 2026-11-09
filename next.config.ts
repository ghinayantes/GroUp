import type { NextConfig } from "next";

// File tracing does not follow onnxruntime-node's native binary or its CommonJS dependency; without these the
// deployed function fails with "Cannot find module onnxruntime-common/dist/cjs". Only the build platform's binary is copied.
const intentClassifierFiles = [
  "./models/intent-classifier/**",
  "./node_modules/onnxruntime-node/package.json",
  "./node_modules/onnxruntime-node/dist/**",
  `./node_modules/onnxruntime-node/bin/napi-v6/${process.platform}/${process.arch}/**`,
  "./node_modules/onnxruntime-common/dist/cjs/**",
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Lets phones on the same Wi-Fi load dev JS via the laptop's LAN IP; without it buttons don't respond.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  outputFileTracingIncludes: {
    "/api/whatsapp/webhook": intentClassifierFiles,
    "/api/simulator/message": intentClassifierFiles,
  },
};

export default nextConfig;

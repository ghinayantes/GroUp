import type { NextConfig } from "next";

// File tracing does not follow onnxruntime-node's native binary or its CommonJS dependency; without these the
// deployed function fails with "Cannot find module onnxruntime-common/dist/cjs". Only the build platform's binary is copied.
const ORT_BIN = "./node_modules/onnxruntime-node/bin/napi-v6";
const ORT_PLATFORMS = ["darwin/arm64", "darwin/x64", "linux/arm64", "linux/x64", "win32/arm64", "win32/x64"];
const buildPlatform = `${process.platform}/${process.arch}`;

const intentClassifierFiles = [
  "./models/intent-classifier/**",
  "./node_modules/onnxruntime-node/package.json",
  "./node_modules/onnxruntime-node/dist/**",
  `${ORT_BIN}/${buildPlatform}/**`,
  "./node_modules/onnxruntime-common/dist/cjs/**",
];

// onnxruntime-node ships every platform's binary (±290 MB) and transformers.js bundles its own onnxruntime-web,
// so tracing them all pushes each agent function to ±250 MB. sharp stays: transformers.js imports it at load time.
const unusedClassifierFiles = [
  ...ORT_PLATFORMS.filter((platform) => platform !== buildPlatform).map((platform) => `${ORT_BIN}/${platform}/**`),
  "./node_modules/onnxruntime-web/**",
  "./lib/agent/stage1/__fixtures__/**",
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Lets phones on the same Wi-Fi load dev JS via the laptop's LAN IP; without it buttons don't respond.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  async redirects() {
    return [{ source: "/admin/login", destination: "/masuk?peran=admin", permanent: true }];
  },
  outputFileTracingIncludes: {
    "/api/whatsapp/webhook": intentClassifierFiles,
    "/api/simulator/message": intentClassifierFiles,
  },
  outputFileTracingExcludes: {
    "/api/whatsapp/webhook": unusedClassifierFiles,
    "/api/simulator/message": unusedClassifierFiles,
  },
};

export default nextConfig;

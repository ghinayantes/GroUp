import type { NextConfig } from "next";

// Classifier tahap 1 baru dimuat bila models/intent-classifier/onnx/model_quantized.onnx ada. Selama model belum
// dicommit, runtime ONNX dan Transformers tidak pernah dipakai tapi ikut ter-trace (±250 MB per fungsi).
// Saat model ditambahkan, hapus exclude ini dan sertakan model, onnxruntime-node (binary platform build),
// serta onnxruntime-common/dist/cjs lewat outputFileTracingIncludes.
const unusedClassifierRuntime = [
  "./node_modules/onnxruntime-node/**",
  "./node_modules/onnxruntime-common/**",
  "./node_modules/onnxruntime-web/**",
  "./node_modules/@huggingface/transformers/**",
  "./node_modules/sharp/**",
  "./node_modules/@img/**",
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
    // Strip metrik di halaman depan membaca hasil eval dan data uji saat request.
    "/": ["./evals/results/**", "./ai/data/test.jsonl"],
  },
  outputFileTracingExcludes: {
    "/api/whatsapp/webhook": unusedClassifierRuntime,
    "/api/simulator/message": unusedClassifierRuntime,
  },
};

export default nextConfig;

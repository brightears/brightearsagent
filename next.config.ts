import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer pulls in native-ish deps (yoga wasm, fontkit) that must
  // not pass through the bundler — keep it external so it's required at runtime.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;

import webpack from "next/dist/compiled/webpack/webpack-lib.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    // @wagmi/connectors pulls in Coinbase's SDK, whose x402 payment helpers import optional
    // packages that are not installed. We never use that path; ignore it instead of shipping it.
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }));
    return config;
  },
};
export default nextConfig;

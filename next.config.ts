import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/payslips/pdf': ['./assets/fonts/NotoSansDevanagari.ttf'],
    '/api/invoices/pdf': ['./assets/fonts/NotoSansDevanagari.ttf'],
  },
};

export default nextConfig;

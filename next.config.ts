import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*', // Apply to all paths
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-eval' 'unsafe-inline' www.google.com www.gstatic.com;
              img-src 'self' data: www.google.com www.gstatic.com;
              frame-src 'self' www.google.com;
              connect-src 'self' www.google.com www.gstatic.com;
              style-src 'self' 'unsafe-inline' www.google.com www.gstatic.com;
              font-src 'self' data:;
              object-src 'none';
              base-uri 'self';
              form-action 'self';
              frame-ancestors 'self';
              block-all-mixed-content;
              upgrade-insecure-requests;
            `.replace(/\s{2,}/g, ' ').trim(),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
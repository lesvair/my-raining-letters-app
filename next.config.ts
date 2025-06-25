/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.google.com https://www.gstatic.com;
              img-src 'self' data: https://www.google.com https://www.gstatic.com;
              style-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com;
              font-src 'self' data:;
              connect-src 'self' https://www.google.com https://www.gstatic.com;
              frame-src 'self' https://www.google.com;
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
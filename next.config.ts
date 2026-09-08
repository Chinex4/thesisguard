import type { NextConfig } from 'next';
const nextConfig: NextConfig = { serverExternalPackages: ['pdf-parse','mammoth','undici'], experimental: { serverActions: { bodySizeLimit: '1mb' } }, async headers() { return [{source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'}]}]; } };
export default nextConfig;

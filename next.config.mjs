/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['react-icons']
  },
  images: {
    domains: ["fonts.googleapis.com", "images.unsplash.com"],
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
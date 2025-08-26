/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['react-icons'],
    serverComponentsExternalPackages: ['bcryptjs', 'argon2']
  },
  images: {
    domains: ["fonts.googleapis.com", "images.unsplash.com"],
    formats: ['image/avif', 'image/webp'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude server-only modules from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        crypto: false,
        stream: false,
        path: false,
        os: false,
      }
      
      // Exclude server-only packages from client bundle
      config.externals = config.externals || []
      config.externals.push('bcryptjs')
      config.externals.push('argon2')
    }
    
    return config
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Drei is a barrel of ~150 modules. This rewrites `import { X } from '@react-three/drei'`
    // to the individual module paths, so dev compiles (and prod bundles) only what we use.
    optimizePackageImports: ['@react-three/drei'],
  },
};

export default nextConfig;

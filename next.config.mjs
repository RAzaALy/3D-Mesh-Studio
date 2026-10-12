/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three.js ships ESM; transpiling keeps tree-shaking predictable across drei/fiber.
  transpilePackages: ['three'],
};

export default nextConfig;

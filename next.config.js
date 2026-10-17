/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    // Troca de tela com animação nativa (View Transitions)
    viewTransition: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
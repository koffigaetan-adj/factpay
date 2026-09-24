/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit lit ses polices depuis le disque, PGlite charge un fichier WebAssembly :
  // on les laisse hors du bundle.
  serverExternalPackages: ['pdfkit', '@electric-sql/pglite'],
  // Les polices standard de pdfkit (fichiers .afm) sont lues sur le disque : on les emporte sur Vercel
  outputFileTracingIncludes: {
    '/**': ['./node_modules/pdfkit/js/data/**'],
  },
  experimental: {
    // Justificatifs de paiement jusqu'à 4 Mo (limite des fonctions Vercel : 4,5 Mo)
    serverActions: { bodySizeLimit: '4.5mb' },
  },
};

export default nextConfig;

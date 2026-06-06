import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // URL base do site — usada em links de reset de senha e emails
    // Em produção é sobrescrita pela env var NEXT_PUBLIC_SITE_URL do Vercel
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  },
};

export default nextConfig;


import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL").optional().default("http://localhost:3000"),
  ZOHO_CLIENT_ID: z.string().min(1, "ZOHO_CLIENT_ID is required"),
  ZOHO_CLIENT_SECRET: z.string().min(1, "ZOHO_CLIENT_SECRET is required"),
  ZOHO_REFRESH_TOKEN: z.string().min(1, "ZOHO_REFRESH_TOKEN is required"),
  ZOHO_ORGANIZATION_ID: z.string().min(1, "ZOHO_ORGANIZATION_ID is required"),
  ZOHO_API_DOMAIN: z.string().min(1, "ZOHO_API_DOMAIN is required").default("https://www.zohoapis.com"),
  DEFAULT_ZOHO_WAREHOUSE_ID: z.string().min(1, "DEFAULT_ZOHO_WAREHOUSE_ID is required"),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID,
    ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET,
    ZOHO_REFRESH_TOKEN: process.env.ZOHO_REFRESH_TOKEN,
    ZOHO_ORGANIZATION_ID: process.env.ZOHO_ORGANIZATION_ID,
    ZOHO_API_DOMAIN: process.env.ZOHO_API_DOMAIN,
    DEFAULT_ZOHO_WAREHOUSE_ID: process.env.DEFAULT_ZOHO_WAREHOUSE_ID,
  });

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    const errorMessage = `\n❌ [FATAL CONFIG ERROR] Missing or invalid environment variables:\n${errorDetails}\n\nPlease check your .env file against .env.example.\n`;
    
    // In production or runtime API execution, throw immediately
    console.error(errorMessage);
    if (process.env.NODE_ENV === "production") {
      throw new Error(errorMessage);
    }
  }

  cachedEnv = (parsed.data as Env) || (process.env as unknown as Env);
  return cachedEnv;
}

export const env = getEnv();

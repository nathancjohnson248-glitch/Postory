import "server-only";

/**
 * Server-side configuration. Nothing here is ever sent to the browser.
 * Every accessor is lazy so a missing optional integration never breaks the
 * build; features check `is*Configured()` and render an honest
 * "not configured" state instead of pretending to work.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export class ConfigurationError extends Error {
  constructor(public readonly variable: string, message?: string) {
    super(message ?? `${variable} is not configured.`);
    this.name = "ConfigurationError";
  }
}

export function requireEnv(name: string): string {
  const value = read(name);
  if (!value) throw new ConfigurationError(name);
  return value;
}

export const env = {
  appUrl: () => (read("NEXT_PUBLIC_APP_URL") ?? "https://postory.lol").replace(/\/+$/, ""),

  supabaseUrl: () => read("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: () => read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  supabaseSecretKey: () => read("SUPABASE_SECRET_KEY"),

  letmepostApiKey: () => read("LETMEPOST_API_KEY"),
  publoraApiKey: () => read("PUBLORA_API_KEY"),
  postizApiKey: () => read("POSTIZ_API_KEY"),
  nangoSecretKey: () => read("NANGO_SECRET_KEY"),
  /** Postiz Cloud by default; a self-hosted instance is https://your-domain/api/public/v1. */
  postizApiUrl: () => (read("POSTIZ_API_URL") ?? "https://api.postiz.com/public/v1").replace(/\/+$/, ""),
  letmepostBaseUrl: () => (read("LETMEPOST_API_BASE_URL") ?? "https://api.letmepost.dev").replace(/\/+$/, ""),

  handypayApiKey: () => read("HANDYPAY_API_KEY"),
  handypayBaseUrl: () => (read("HANDYPAY_API_BASE_URL") ?? "https://api.handypay.me/api").replace(/\/+$/, ""),

  // Gemini is Postory's model provider; OpenAI is only a fallback.
  geminiApiKey: () => read("GEMINI_API_KEY"),
  geminiModel: () => read("GEMINI_MODEL") ?? "gemini-3.5-flash",
  geminiImageModel: () => read("GEMINI_IMAGE_MODEL") ?? "gemini-3.1-flash-image",

  // Cloudflare Workers AI: post images.
  cloudflareAccountId: () => read("CLOUDFLARE_ACCOUNT_ID"),
  cloudflareAiToken: () => read("CLOUDFLARE_AI_TOKEN"),
  cloudflareImageModel: () => read("CLOUDFLARE_IMAGE_MODEL") ?? "@cf/leonardo/lucid-origin",

  // Groq: fast text fallback (OpenAI-compatible API). No images.
  groqApiKey: () => read("GROQ_API_KEY"),
  groqModel: () => read("GROQ_MODEL") ?? "openai/gpt-oss-120b",
  replicateApiToken: () => read("REPLICATE_API_TOKEN"),
  /** Meta's Llama on Replicate (llama-3.3-70b-instruct isn't hosted there; Maverick is the current flagship). */
  replicateTextModel: () => read("REPLICATE_TEXT_MODEL") ?? "meta/llama-4-maverick-instruct",
  replicateFastModel: () => read("REPLICATE_FAST_MODEL") ?? "meta/llama-4-maverick-instruct",
  replicateImageModel: () => read("REPLICATE_IMAGE_MODEL") ?? "black-forest-labs/flux-1.1-pro",
  openrouterApiKey: () => read("OPENROUTER_API_KEY"),
  /** The writer: quality first. */
  openrouterModel: () => read("OPENROUTER_MODEL") ?? "anthropic/claude-sonnet-5.5",
  /** Quick checks (claim check): fast and cheap. */
  openrouterFastModel: () => read("OPENROUTER_FAST_MODEL") ?? "anthropic/claude-haiku-5.5",
  openrouterImageModel: () => read("OPENROUTER_IMAGE_MODEL") ?? "bytedance-seed/seedream-5-0-lite",

  openaiApiKey: () => read("OPENAI_API_KEY"),
  openaiModel: () => read("OPENAI_MODEL") ?? "gpt-5.4-mini",
  openaiImageModel: () => read("OPENAI_IMAGE_MODEL") ?? "gpt-image-2",

  // Any SMTP mailbox (e.g. Zoho Mail: smtp.zoho.com, 465). Used when the Zoho API isn't set.
  smtpHost: () => read("SMTP_HOST"),
  smtpPort: () => Number(read("SMTP_PORT") ?? 465),
  smtpUser: () => read("SMTP_USER"),
  smtpPassword: () => read("SMTP_PASSWORD"),
  smtpFrom: () => read("SMTP_FROM") ?? read("SMTP_USER"),
  // Zoho Mail over its HTTPS API (Railway blocks SMTP below Pro).
  zohoClientId: () => read("ZOHO_CLIENT_ID"),
  zohoClientSecret: () => read("ZOHO_CLIENT_SECRET"),
  zohoRefreshToken: () => read("ZOHO_REFRESH_TOKEN"),
  zohoAccountId: () => read("ZOHO_ACCOUNT_ID"),
  zohoFrom: () => read("ZOHO_FROM") ?? "Postory <mail@postory.lol>",
  zohoAccountsUrl: () => (read("ZOHO_ACCOUNTS_URL") ?? "https://accounts.zoho.com").replace(/\/+$/, ""),
  zohoMailUrl: () => (read("ZOHO_MAIL_URL") ?? "https://mail.zoho.com").replace(/\/+$/, ""),
  /** Sign-up and reset codes by email; switched on only once delivery is confirmed. */
  authEmailCodes: () => read("AUTH_EMAIL_CODES") === "on",
  emailTestToken: () => read("EMAIL_TEST_TOKEN"),

  // Google sign-in through Privy. The app id is public; the secret stays here.
  privyAppId: () => read("PRIVY_APP_ID") ?? read("NEXT_PUBLIC_PRIVY_APP_ID"),
  privyAppSecret: () => read("PRIVY_APP_SECRET"),

  devPlan: () => (process.env.NODE_ENV === "development" ? read("POSTORY_DEV_PLAN") : undefined),
};

export const integrations = {
  supabase: () => Boolean(env.supabaseUrl() && env.supabasePublishableKey()),
  supabaseAdmin: () => Boolean(env.supabaseUrl() && env.supabaseSecretKey()),
  letmepost: () => Boolean(env.letmepostApiKey()),
  publora: () => Boolean(env.publoraApiKey()),
  postiz: () => Boolean(env.postizApiKey()),
  nango: () => Boolean(env.nangoSecretKey()),
  privy: () => Boolean(env.privyAppId() && env.privyAppSecret()),
  handypay: () => Boolean(env.handypayApiKey()),
  gemini: () => Boolean(env.geminiApiKey()),
  groq: () => Boolean(env.groqApiKey()),
  openrouter: () => Boolean(env.openrouterApiKey()),
  replicate: () => Boolean(env.replicateApiToken()),
  cloudflareAi: () => Boolean(env.cloudflareAccountId() && env.cloudflareAiToken()),
  openai: () => Boolean(env.openaiApiKey()),
  smtp: () => Boolean(env.smtpHost() && env.smtpUser() && env.smtpPassword()),
  zoho: () => Boolean(env.zohoClientId() && env.zohoClientSecret() && env.zohoRefreshToken() && env.zohoAccountId()),
  /** Postory can send email from its own address (Zoho or SMTP). */
  email: () => integrations.zoho() || integrations.smtp(),
};

export type IntegrationStatus = Record<keyof typeof integrations, boolean>;

export function integrationStatus(): IntegrationStatus {
  return {
    supabase: integrations.supabase(),
    supabaseAdmin: integrations.supabaseAdmin(),
    letmepost: integrations.letmepost(),
    publora: integrations.publora(),
    postiz: integrations.postiz(),
    nango: integrations.nango(),
    privy: integrations.privy(),
    handypay: integrations.handypay(),
    gemini: integrations.gemini(),
    groq: integrations.groq(),
    openrouter: integrations.openrouter(),
    replicate: integrations.replicate(),
    cloudflareAi: integrations.cloudflareAi(),
    openai: integrations.openai(),
    smtp: integrations.smtp(),
    zoho: integrations.zoho(),
    email: integrations.email(),
  };
}

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

  // Nango holds OAuth tokens for X, LinkedIn, Threads, Instagram, Facebook and Pinterest.
  nangoSecretKey: () => read("NANGO_SECRET_KEY"),
  /** 32 random bytes, base64. Encrypts secrets Nango can't hold (Bluesky app passwords). */
  credentialsKey: () => read("CREDENTIALS_KEY"),

  handypayApiKey: () => read("HANDYPAY_API_KEY"),
  handypayBaseUrl: () => (read("HANDYPAY_API_BASE_URL") ?? "https://api.handypay.me/api").replace(/\/+$/, ""),

  // All text goes to one OpenAI-compatible chat completions API (Groq, OpenAI,
  // DeepSeek, Together, Azure AI Foundry, OpenRouter, SambaNova...). Switch
  // providers by changing these three; no code change needed.
  aiTextBaseUrl: () => read("AI_TEXT_BASE_URL")?.replace(/\/+$/, ""),
  aiTextApiKey: () => read("AI_TEXT_API_KEY"),
  aiTextModel: () => read("AI_TEXT_MODEL") ?? "",
  aiTextFastModel: () => read("AI_TEXT_FAST_MODEL") ?? read("AI_TEXT_MODEL") ?? "",
  aiTextMaxTokens: () => Number(read("AI_TEXT_MAX_TOKENS") ?? 4000),
  // Replicate makes images only.
  replicateApiToken: () => read("REPLICATE_API_TOKEN"),
  replicateImageModel: () => read("REPLICATE_IMAGE_MODEL") ?? "black-forest-labs/flux-1.1-pro",

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
  aiCheckToken: () => read("AI_CHECK_TOKEN"),

  // Google sign-in through Privy. The app id is public; the secret stays here.
  privyAppId: () => read("PRIVY_APP_ID") ?? read("NEXT_PUBLIC_PRIVY_APP_ID"),
  privyAppSecret: () => read("PRIVY_APP_SECRET"),

  devPlan: () => (process.env.NODE_ENV === "development" ? read("POSTORY_DEV_PLAN") : undefined),
};

export const integrations = {
  supabase: () => Boolean(env.supabaseUrl() && env.supabasePublishableKey()),
  supabaseAdmin: () => Boolean(env.supabaseUrl() && env.supabaseSecretKey()),
  nango: () => Boolean(env.nangoSecretKey()),
  privy: () => Boolean(env.privyAppId() && env.privyAppSecret()),
  handypay: () => Boolean(env.handypayApiKey()),
  replicate: () => Boolean(env.replicateApiToken()),
  aiText: () => Boolean(env.aiTextBaseUrl() && env.aiTextApiKey() && env.aiTextModel()),
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
    nango: integrations.nango(),
    privy: integrations.privy(),
    handypay: integrations.handypay(),
    replicate: integrations.replicate(),
    aiText: integrations.aiText(),
    smtp: integrations.smtp(),
    zoho: integrations.zoho(),
    email: integrations.email(),
  };
}

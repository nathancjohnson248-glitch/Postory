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

  // SambaNova Cloud writes first (OpenAI-compatible chat API); Replicate is the fallback and makes images.
  sambanovaApiKey: () => read("SAMBANOVA_API_KEY"),
  sambanovaModel: () => read("SAMBANOVA_MODEL") ?? "DeepSeek-V3.1",
  sambanovaFastModel: () => read("SAMBANOVA_FAST_MODEL") ?? "Meta-Llama-3.3-70B-Instruct",
  replicateApiToken: () => read("REPLICATE_API_TOKEN"),
  // Replicate runs all of Postory's AI. Text models take prompt + system_prompt; see lib/ai/llm.ts.
  replicateTextModel: () => read("REPLICATE_TEXT_MODEL") ?? "anthropic/claude-4.5-sonnet",
  replicateFastModel: () => read("REPLICATE_FAST_MODEL") ?? "anthropic/claude-4.5-haiku",
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
  sambanova: () => Boolean(env.sambanovaApiKey()),
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
    sambanova: integrations.sambanova(),
    smtp: integrations.smtp(),
    zoho: integrations.zoho(),
    email: integrations.email(),
  };
}

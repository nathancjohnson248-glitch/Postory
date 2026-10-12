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
  letmepostBaseUrl: () => (read("LETMEPOST_API_BASE_URL") ?? "https://api.letmepost.dev").replace(/\/+$/, ""),

  handypayApiKey: () => read("HANDYPAY_API_KEY"),
  handypayBaseUrl: () => (read("HANDYPAY_API_BASE_URL") ?? "https://api.handypay.me/api").replace(/\/+$/, ""),

  openaiApiKey: () => read("OPENAI_API_KEY"),
  openaiModel: () => read("OPENAI_MODEL") ?? "gpt-5.4-mini",
  openaiImageModel: () => read("OPENAI_IMAGE_MODEL") ?? "gpt-image-2",

  resendApiKey: () => read("RESEND_API_KEY"),
  resendFromEmail: () => read("RESEND_FROM_EMAIL"),

  // Any SMTP mailbox (e.g. Zoho Mail: smtp.zoho.com, 465). Used when Resend isn't set.
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
  privy: () => Boolean(env.privyAppId() && env.privyAppSecret()),
  handypay: () => Boolean(env.handypayApiKey()),
  openai: () => Boolean(env.openaiApiKey()),
  resend: () => Boolean(env.resendApiKey() && env.resendFromEmail()),
  smtp: () => Boolean(env.smtpHost() && env.smtpUser() && env.smtpPassword()),
  zoho: () => Boolean(env.zohoClientId() && env.zohoClientSecret() && env.zohoRefreshToken() && env.zohoAccountId()),
  /** Postory can send email from its own address (Zoho, SMTP or Resend). */
  email: () => integrations.zoho() || integrations.smtp() || integrations.resend(),
};

export type IntegrationStatus = Record<keyof typeof integrations, boolean>;

export function integrationStatus(): IntegrationStatus {
  return {
    supabase: integrations.supabase(),
    supabaseAdmin: integrations.supabaseAdmin(),
    letmepost: integrations.letmepost(),
    publora: integrations.publora(),
    privy: integrations.privy(),
    handypay: integrations.handypay(),
    openai: integrations.openai(),
    resend: integrations.resend(),
    smtp: integrations.smtp(),
    zoho: integrations.zoho(),
    email: integrations.email(),
  };
}

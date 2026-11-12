import "server-only";

import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM?.trim();
  const port = Number(process.env.SMTP_PORT ?? "587");
  const secureSetting = process.env.SMTP_SECURE?.trim().toLowerCase();
  if (!host || !user || !password || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM must be configured for email delivery.");
  }
  if (secureSetting && secureSetting !== "true" && secureSetting !== "false") {
    throw new Error("SMTP_SECURE must be either true or false.");
  }
  return {
    transport: nodemailer.createTransport({
      host,
      port,
      secure: secureSetting ? secureSetting === "true" : port === 465,
      auth: { user, pass: password },
    }),
    from,
  };
}

function appUrl(path: string): string {
  const configuredUrl = process.env.APP_URL?.trim() || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
  if (!configuredUrl) throw new Error("APP_URL must be configured for production email links.");
  let base: URL;
  try {
    base = new URL(configuredUrl);
  } catch {
    throw new Error("APP_URL must be a valid absolute URL.");
  }
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash ||
    (process.env.NODE_ENV === "production" && base.protocol !== "https:")
  ) {
    throw new Error("APP_URL must be an HTTPS application origin in production and must not contain credentials, a path, or query parameters.");
  }
  return new URL(path, base).toString();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  const { transport, from } = getTransport();
  const link = appUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  const greeting = escapeHtml(name);
  await transport.sendMail({
    from,
    to,
    subject: "Verify your EduReels email",
    text: `Hello ${name}, verify your EduReels email by visiting ${link}. This link expires in 24 hours.`,
    html: `<p>Hello ${greeting},</p><p>Verify your EduReels email to finish creating your account.</p><p><a href="${link}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const { transport, from } = getTransport();
  const link = appUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  const greeting = escapeHtml(name);
  await transport.sendMail({
    from,
    to,
    subject: "Reset your EduReels password",
    text: `Hello ${name}, reset your EduReels password by visiting ${link}. This link expires in one hour.`,
    html: `<p>Hello ${greeting},</p><p>We received a request to reset your EduReels password.</p><p><a href="${link}">Reset password</a></p><p>This link expires in one hour. Ignore this email if you did not request a reset.</p>`,
  });
}

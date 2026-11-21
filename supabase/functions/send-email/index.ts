// Supabase Auth "Send Email" hook for ez-workout.
// Why: Supabase's built-in SMTP sends mail without a Message-ID header. Gravity (cPanel exim)
// DKIM-signs with Message-ID in h=, then the MailChannels relay adds a Message-ID, which breaks
// DKIM and so DMARC. Sending ourselves lets nodemailer set the Message-ID before gravity signs.
// Port 465 because Supabase Edge Functions block outbound 25 and 587.
// Secrets (set in the dashboard, never in code): SEND_EMAIL_HOOK_SECRET, SMTP_PASS.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Webhook } from "npm:standardwebhooks@1.0.0";
import nodemailer from "npm:nodemailer@6.9.16";

const FROM_ADDR = "workout@gotmountains.ca";
const FROM_NAME = "ez-workout";

const transport = nodemailer.createTransport({
  host: "gravity.cynderhost.com",
  port: 465,
  secure: true,
  auth: { user: FROM_ADDR, pass: Deno.env.get("SMTP_PASS") ?? "" },
});

type EmailData = {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new?: string;
  token_hash_new?: string;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function verifyUrl(tokenHash: string, type: string, redirectTo: string): string {
  const base = Deno.env.get("SUPABASE_URL") ?? "";
  const u = new URL(`${base}/auth/v1/verify`);
  u.searchParams.set("token", tokenHash);
  u.searchParams.set("type", type);
  if (redirectTo) u.searchParams.set("redirect_to", redirectTo);
  return u.toString();
}

// A reset link must not spend its token on a plain GET (EZ-49). On
// 2026-11-21 a mail scanner opened Marilyn's /auth/v1/verify link eight
// seconds after it was sent and used the one-time token, so her own click
// three seconds later failed. This link goes to the app instead, carrying the
// token_hash; the app spends it only when a person presses Continue
// (src/pages/ResetPassword.tsx). The origin comes from redirect_to, which
// Supabase has already checked against the redirect allow-list, falling back
// to the Site URL.
function resetPageUrl(tokenHash: string, redirectTo: string, siteUrl: string): string {
  let origin = siteUrl;
  try {
    if (redirectTo) origin = new URL(redirectTo).origin;
  } catch {
    // keep the Site URL
  }
  const u = new URL("/reset-password", origin);
  u.searchParams.set("token_hash", tokenHash);
  u.searchParams.set("type", "recovery");
  return u.toString();
}

function linkMail(subject: string, heading: string, lead: string, button: string, url: string) {
  const html = `<h2>${esc(heading)}</h2>\n<p>${esc(lead)}</p>\n<p><a href="${esc(url)}">${esc(button)}</a></p>\n` +
    `<p style="color:#666;font-size:12px">If you didn't ask for this, you can ignore this email.</p>`;
  const text = `${heading}\n\n${lead}\n${url}\n\nIf you didn't ask for this, you can ignore this email.`;
  return { subject, html, text };
}

function build(d: EmailData, newEmail?: string) {
  const t = d.email_action_type;
  switch (t) {
    case "signup":
      return linkMail("Confirm your signup", "Confirm your signup", "Follow this link to confirm your account:", "Confirm your email", verifyUrl(d.token_hash, "signup", d.redirect_to));
    case "recovery":
      return linkMail("Reset your password", "Reset your password", "Follow this link to reset the password for your account:", "Reset password", resetPageUrl(d.token_hash, d.redirect_to, d.site_url));
    case "magiclink":
      return linkMail("Your sign-in link", "Your sign-in link", "Follow this link to sign in:", "Sign in", verifyUrl(d.token_hash, "magiclink", d.redirect_to));
    case "invite":
      return linkMail("You have been invited", "You have been invited", "Follow this link to accept the invitation:", "Accept the invitation", verifyUrl(d.token_hash, "invite", d.redirect_to));
    case "email_change":
      return linkMail("Confirm your new email", "Confirm your email change", `Follow this link to confirm the change${newEmail ? " to " + newEmail : ""}:`, "Confirm the change", verifyUrl(d.token_hash, "email_change", d.redirect_to));
    case "reauthentication": {
      const html = `<h2>Confirm it's you</h2>\n<p>Enter this code: <strong>${esc(d.token)}</strong></p>`;
      return { subject: "Your confirmation code", html, text: `Confirm it's you\n\nEnter this code: ${d.token}` };
    }
    default:
      return null;
  }
}

async function send(to: string, mail: { subject: string; html: string; text: string }) {
  await transport.sendMail({
    from: { name: FROM_NAME, address: FROM_ADDR },
    to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    messageId: `<${crypto.randomUUID()}@gotmountains.ca>`,
  });
}

function hookError(status: number, message: string) {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return hookError(405, "Method not allowed");
  const secret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").replace("v1,whsec_", "");
  if (!secret) return hookError(500, "Hook secret not set");

  const payload = await req.text();
  let body: { user: { email: string; new_email?: string }; email_data: EmailData };
  try {
    body = new Webhook(secret).verify(payload, Object.fromEntries(req.headers)) as typeof body;
  } catch {
    return hookError(401, "Invalid signature");
  }

  const { user, email_data: d } = body;
  try {
    // Secure email change sends two mails: one to the current address, one to the new one.
    if (d.email_action_type === "email_change" && d.token_hash_new && user.new_email) {
      const cur = build({ ...d, token_hash: d.token_hash_new }, user.new_email);
      const nxt = build(d, user.new_email);
      if (cur) await send(user.email, cur);
      if (nxt) await send(user.new_email, nxt);
    } else {
      const mail = build(d, user.new_email);
      if (!mail) return hookError(400, `Unsupported email type: ${d.email_action_type}`);
      await send(user.email, mail);
    }
  } catch (e) {
    console.error("send failed", e instanceof Error ? e.message : String(e));
    return hookError(500, "Email could not be sent");
  }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
});

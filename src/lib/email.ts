import nodemailer from "nodemailer";
import { env } from "@/config/env";

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

function createTransporter() {
  if (!env.SMTP_HOST) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ? Number(env.SMTP_PORT) : 587,
    secure: env.SMTP_SECURE === "true",
    auth: env.SMTP_USER
      ? {
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD,
        }
      : undefined,
  });
}

export async function sendEmail(options: SendEmailOptions) {
  if (!env.SMTP_HOST || !env.SMTP_FROM) {
    console.log("Email not sent because SMTP is not configured.");
    console.log("Email details:", options);
    return;
  }

  const transporter = createTransporter();
  if (!transporter) {
    console.log("Email transporter could not be created.");
    console.log("Email details:", options);
    return;
  }

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
}

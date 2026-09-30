/**
 * Outbound email.
 *
 * Release 1 ships without a provider binding: with no SMTP/API credentials
 * configured, messages are written to the server log so the reminder pipeline
 * can be exercised end to end. To go live, set `MAIL_PROVIDER` plus its key and
 * implement the one function below - nothing else in the app changes.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailTransport {
  name: string;
  send(message: EmailMessage): Promise<void>;
}

const logTransport: EmailTransport = {
  name: "log",
  async send(message) {
    // Writing the message to the server log is this transport's entire job,
    // so the no-console rule does not apply here.
    // eslint-disable-next-line no-console
    console.info(`[fintarg:email] to=${message.to} subject="${message.subject}"\n${message.text}`);
  },
};

/** Placeholder for a real provider (Resend, Postmark, SES, SMTP). */
const httpTransport: EmailTransport = {
  name: "http",
  async send(message) {
    const endpoint = process.env.MAIL_ENDPOINT;
    const apiKey = process.env.MAIL_API_KEY;
    if (!endpoint || !apiKey) {
      await logTransport.send(message);
      return;
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ to: message.to, subject: message.subject, text: message.text, html: message.html }),
    });
    if (!response.ok) {
      throw new Error(`Mail provider responded ${response.status}`);
    }
  },
};

export function mailTransport(): EmailTransport {
  return process.env.MAIL_PROVIDER === "http" ? httpTransport : logTransport;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  await mailTransport().send(message);
}

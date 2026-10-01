/**
 * Outbound SMS (D4).
 *
 * Same shape and intent as `mailer.ts`: with no provider configured, messages are
 * written to the server log so password resets and reminder delivery can be
 * exercised end to end. To go live, set `SMS_PROVIDER=http` plus `SMS_ENDPOINT`
 * and `SMS_API_KEY` and implement the one function below.
 */

export interface SmsMessage {
  to: string;
  body: string;
}

export interface SmsTransport {
  name: string;
  send(message: SmsMessage): Promise<void>;
}

const logTransport: SmsTransport = {
  name: "log",
  async send(message) {
    // Writing the message to the server log is this transport's entire job,
    // so the no-console rule does not apply here.
    // eslint-disable-next-line no-console
    console.info(`[fintarg:sms] to=${message.to}\n${message.body}`);
  },
};

/** Placeholder for a real provider (Twilio, MessageBird, Dialog). */
const httpTransport: SmsTransport = {
  name: "http",
  async send(message) {
    const endpoint = process.env.SMS_ENDPOINT;
    const apiKey = process.env.SMS_API_KEY;
    if (!endpoint || !apiKey) {
      await logTransport.send(message);
      return;
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ to: message.to, body: message.body }),
    });
    if (!response.ok) {
      throw new Error(`SMS provider responded ${response.status}`);
    }
  },
};

export function smsTransport(): SmsTransport {
  return process.env.SMS_PROVIDER === "http" ? httpTransport : logTransport;
}

export async function sendSms(message: SmsMessage): Promise<void> {
  await smsTransport().send(message);
}
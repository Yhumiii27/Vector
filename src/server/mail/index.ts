import 'server-only';
// Sending an e-mail with the transport of VECTOR_MAIL_TRANSPORT (RFQs to the forwarders). `none` (default): nothing is sent —
// the screen shows the message to copy into the mailbox. `file`: the message is written as an .eml file in
// VECTOR_MAIL_DIR (readable by its owner only), for tests and the sandbox. Microsoft Graph (`Mail.Send`) or SMTP is to be
// chosen with the IT department: not built, so no message leaves the server. Never logs the body.
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { emlOf } from '@/domain/mail';
import { getConfig, type MailTransport } from '@/server/config';
import { log } from '@/server/log';

export interface MailSettings {
  transport: MailTransport;
  dir: string | null;
  from: string;
}

export const mailSettings = (): MailSettings => getConfig().mail;

/** True when Vector can send an e-mail (a transport other than `none` is configured). */
export const canSendMail = (m: MailSettings = mailSettings()) => m.transport !== 'none';

export type SendResult = { ok: true; transport: Exclude<MailTransport, 'none'> } | { ok: false; error: string };

/** Sends one message (`none`: refused, nothing written). Never logs the body. */
export async function sendMail(m: MailSettings, msg: { to: string; toName: string | null; subject: string; body: string }, now = new Date()): Promise<SendResult> {
  if (m.transport === 'none' || !m.dir) return { ok: false, error: 'No e-mail transport is configured' };
  const id = randomUUID();
  try {
    await mkdir(m.dir, { recursive: true, mode: 0o700 });
    const file = path.join(m.dir, `${now.toISOString().replace(/[:.]/g, '-')}-${id}.eml`);
    await writeFile(file, emlOf({ id, from: m.from, to: msg.to, toName: msg.toName, subject: msg.subject, body: msg.body, date: now }), { mode: 0o600 });
    await chmod(file, 0o600);
    return { ok: true, transport: 'file' };
  } catch (e) {
    const error = String(e instanceof Error ? e.message : e).slice(0, 500) || 'The message could not be written';
    log.warn('mail.failed', { transport: m.transport, error });
    return { ok: false, error };
  }
}

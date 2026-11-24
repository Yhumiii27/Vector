// An e-mail as an .eml file (RFC 5322, UTF-8 text body in base64), the shape the `file` transport writes and a real transport
// (Microsoft Graph or SMTP, to be chosen with the IT department) would send. Pure. Header values never carry a line break
// (no header injection from a typed name).

/** RFC 2047 encoded word for a header value with non-ASCII characters; line breaks removed. */
export function headerValue(s: string): string {
  const v = s.replace(/[\r\n]+/g, ' ').trim();
  return /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, 'utf8').toString('base64')}?=`;
}

/** A mailbox header: « Name <e-mail> », the name encoded when needed. */
export const mailbox = (email: string, name?: string | null) => (name ? `${headerValue(name)} <${email}>` : email);

export interface MailMessage {
  id: string;
  from: string;
  to: string;
  toName?: string | null;
  subject: string;
  body: string;
  date: Date;
}

export function emlOf(m: MailMessage): string {
  const b64 = Buffer.from(m.body.replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n');
  return [
    `From: ${mailbox(m.from, 'Vector')}`, `To: ${mailbox(m.to, m.toName)}`, `Subject: ${headerValue(m.subject)}`, `Date: ${m.date.toUTCString()}`,
    `Message-ID: <${m.id}@vector>`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64, '',
  ].join('\r\n');
}

import nodemailer from 'nodemailer';

// E-mails par SMTP (Gmail par défaut). Sans SMTP_USER / SMTP_PASS : affichés dans la console.
export const mailTestMode = () => !process.env.SMTP_USER || !process.env.SMTP_PASS;

const g = globalThis;

function transport() {
  if (!g.__mailer) {
    const port = Number(process.env.SMTP_PORT || 465);
    g.__mailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return g.__mailer;
}

// En mode test, la version HTML est enregistrée dans .data/emails pour l'ouvrir dans le navigateur
async function savePreview(subject, html) {
  try {
    const { mkdirSync, writeFileSync } = await import('node:fs');
    mkdirSync('./.data/emails', { recursive: true });
    const file = `./.data/emails/${Date.now()}-${subject.replace(/[^\p{L}\d]+/gu, '-').slice(0, 60)}.html`;
    writeFileSync(file, html);
    return file;
  } catch {
    return null;
  }
}

export async function sendMail({ to, subject, text, html, attachments = [], inline = [], replyTo }) {
  if (mailTestMode()) {
    const files = attachments.map((a) => a.filename).join(', ') || 'aucune';
    // Aperçu : les images intégrées (cid:) deviennent des images data: lisibles par le navigateur
    const previewHtml = html && inline.reduce((h, img) => h.replaceAll(`cid:${img.cid}`, `data:${img.contentType};base64,${Buffer.from(img.content).toString('base64')}`), html);
    const preview = html ? await savePreview(subject, previewHtml) : null;
    console.log(`\n[mode test] E-mail non envoyé (SMTP_USER / SMTP_PASS absents)\n  À : ${to}\n  Sujet : ${subject}\n  ${text.split('\n').join('\n  ')}\n  Pièces jointes : ${files}${preview ? `\n  Aperçu HTML : ${preview}` : ''}\n`);
    return;
  }
  try {
    await transport().sendMail({
      // Gmail impose l'adresse du compte comme expéditeur
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html: html || undefined,
      replyTo: replyTo || undefined,
      attachments: [
        ...attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content) })),
        ...inline.map((img) => ({ filename: img.filename, content: Buffer.from(img.content), contentType: img.contentType, cid: img.cid, contentDisposition: 'inline' })),
      ],
    });
  } catch (err) {
    throw new Error(`Envoi refusé par le serveur SMTP : ${String(err.message).slice(0, 200)}`);
  }
}

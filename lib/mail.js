import nodemailer from 'nodemailer';

// E-mails par SMTP (Gmail par défaut). Sans SMTP_USER / SMTP_PASS : affichés dans la console.
export const mailTestMode = () => !process.env.SMTP_USER || !process.env.SMTP_PASS;

function createTransport(portOverride = null) {
  const port = Number(portOverride || process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE === 'true' ? true : (process.env.SMTP_SECURE === 'false' ? false : port === 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // En environnement serverless (Vercel / AWS), pas de pool persistant car les sockets meurent lors de la mise en veille
    pool: false,
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });
}

function formatFromAddress() {
  const customFrom = process.env.MAIL_FROM;
  const user = process.env.SMTP_USER;
  if (!customFrom) return user;
  if (customFrom.includes('ton-adresse') || customFrom.includes('votre-adresse') || customFrom.includes('example.com')) {
    const nameMatch = customFrom.match(/^"?([^"<]+)"?\s*</);
    const name = nameMatch ? nameMatch[1].trim() : 'FactPay';
    return `"${name}" <${user}>`;
  }
  return customFrom;
}

// En mode test, la version HTML est enregistrée dans .data/emails pour l'ouvrir dans le navigateur
async function savePreview(subject, html) {
  try {
    const { mkdirSync, writeFileSync } = await import('fs');
    mkdirSync('./.data/emails', { recursive: true });
    const file = `./.data/emails/${Date.now()}-${subject.replace(/[^\p{L}\d]+/gu, '-').slice(0, 60)}.html`;
    writeFileSync(file, html);
    return file;
  } catch {
    return null;
  }
}

// Renvoie { sent, testMode } : en mode test rien ne part, l'appelant doit pouvoir le dire
// pour ne pas annoncer un envoi qui n'a pas eu lieu.
export async function sendMail({ to, subject, text, html, attachments = [], inline = [], replyTo }) {
  if (mailTestMode()) {
    const files = attachments.map((a) => a.filename).join(', ') || 'aucune';
    // Aperçu : les images intégrées (cid:) deviennent des images data: lisibles par le navigateur
    const previewHtml = html && inline.reduce((h, img) => h.replaceAll(`cid:${img.cid}`, `data:${img.contentType};base64,${Buffer.from(img.content).toString('base64')}`), html);
    // Les tests automatiques n'enregistrent ni n'affichent rien
    if (process.env.FACTPAY_QUIET) return { sent: false, testMode: true };
    const preview = html ? await savePreview(subject, previewHtml) : null;
    console.log(`\n[mode test] E-mail non envoyé (SMTP_USER / SMTP_PASS absents)\n  À : ${to}\n  Sujet : ${subject}\n  ${text.split('\n').join('\n  ')}\n  Pièces jointes : ${files}${preview ? `\n  Aperçu HTML : ${preview}` : ''}\n`);
    return { sent: false, testMode: true };
  }

  const mailOptions = {
    from: formatFromAddress(),
    to,
    subject,
    text,
    html: html || undefined,
    replyTo: replyTo || undefined,
    attachments: [
      ...attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content) })),
      ...inline.map((img) => ({ filename: img.filename, content: Buffer.from(img.content), contentType: img.contentType, cid: img.cid, contentDisposition: 'inline' })),
    ],
  };

  try {
    const transporter = createTransport();
    await transporter.sendMail(mailOptions);
    transporter.close();
    return { sent: true, testMode: false };
  } catch (err) {
    const msg = String(err?.message || '');
    // Tentative automatique de repli sur port 587 (STARTTLS) si port 465 bloque (Greeting timeout en serverless)
    const currentPort = Number(process.env.SMTP_PORT || 465);
    if (currentPort === 465 && (msg.includes('Greeting never received') || msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ECONNRESET'))) {
      try {
        const fallbackTransporter = createTransport(587);
        await fallbackTransporter.sendMail(mailOptions);
        fallbackTransporter.close();
        return { sent: true, testMode: false };
      } catch (fallbackErr) {
        throw new Error(`Envoi refusé par le serveur SMTP : ${String(fallbackErr.message).slice(0, 200)}`);
      }
    }
    throw new Error(`Envoi refusé par le serveur SMTP : ${msg.slice(0, 200)}`);
  }
}

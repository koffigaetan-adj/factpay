// E-mails via Resend (https://resend.com). Sans RESEND_API_KEY : affichés dans la console.
export const mailTestMode = () => !process.env.RESEND_API_KEY;

export async function sendMail({ to, subject, text, attachments = [], replyTo }) {
  if (mailTestMode()) {
    const files = attachments.map((a) => a.filename).join(', ') || 'aucune';
    console.log(`\n[mode test] E-mail non envoyé (RESEND_API_KEY absent)\n  À : ${to}\n  Sujet : ${subject}\n  ${text.split('\n').join('\n  ')}\n  Pièces jointes : ${files}\n`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to,
      subject,
      text,
      reply_to: replyTo || undefined,
      attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString('base64') })),
    }),
  });
  if (!res.ok) throw new Error(`Envoi refusé par Resend (${res.status}) : ${(await res.text()).slice(0, 200)}`);
}

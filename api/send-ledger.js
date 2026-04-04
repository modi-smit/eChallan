import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { filename, fileData } = req.body;

    const data = await resend.emails.send({
      from: 'Gujarat Oil Depot <system@yourdomain.com>', // Change to your verified Resend domain
      to: ['admin@god.com.in'], // Where you want to receive it
      subject: `Automated Ledger Output: ${filename}`,
      html: `<p>Please find the attached automated ledger.</p>`,
      attachments: [{ filename: filename, content: Buffer.from(fileData).toString('base64') }]
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
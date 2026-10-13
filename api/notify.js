// Vercel serverless function: emails a member when someone comments on their summary.
// Called by the database trigger in supabase/011_email_notifications.sql.
//
// Environment variables (set in Vercel -> Project -> Settings -> Environment Variables):
//   NOTIFY_SECRET  shared secret, must match private.app_secrets.notify_secret
//   SMTP_HOST      e.g. mail.satsa.co.ke
//   SMTP_PORT      465 (SSL) or 587 (STARTTLS)
//   SMTP_USER      mailbox username, e.g. no-reply@satsa.co.ke
//   SMTP_PASS      mailbox password
//   EMAIL_FROM     optional, defaults to SMTP_USER, e.g. "Book Circle <no-reply@satsa.co.ke>"
//   SITE_URL       optional, defaults to https://booksummary-seven.vercel.app
const crypto = require('crypto')
const nodemailer = require('nodemailer')

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function secretsMatch(provided, expected) {
  if (typeof provided !== 'string' || !expected) return false
  const a = crypto.createHash('sha256').update(provided).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

// Keeps header-ish fields to a single, bounded line.
function oneLine(value, max) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max)
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!secretsMatch(req.headers['x-notify-secret'], process.env.NOTIFY_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const to = oneLine(body.to, 254)
  const actor = oneLine(body.actor, 60) || 'A member'
  const bookTitle = oneLine(body.book_title, 200) || 'your book summary'
  const comment = String(body.comment ?? '').trim().slice(0, 500)

  if (!EMAIL_PATTERN.test(to)) {
    return res.status(400).json({ error: 'Invalid recipient' })
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return res.status(500).json({ error: 'Email is not configured' })
  }

  const port = Number(SMTP_PORT) || 465
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })

  const siteUrl = (process.env.SITE_URL || 'https://booksummary-seven.vercel.app').replace(/\/+$/, '')
  const link = `${siteUrl}/index.html?q=${encodeURIComponent(bookTitle)}`
  const subject = `${actor} commented on your book summary`

  const text = [
    `${actor} commented on your book summary “${bookTitle}”:`,
    '',
    comment ? `“${comment}”` : '',
    '',
    `Read and reply: ${link}`,
    '',
    '— Book Circle',
  ]
    .filter((line, i, all) => !(line === '' && all[i - 1] === ''))
    .join('\n')

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#212529">
      <h2 style="color:#3b4cca;margin-bottom:8px">New comment on your summary</h2>
      <p><strong>${escapeHtml(actor)}</strong> commented on your book summary
         <strong>“${escapeHtml(bookTitle)}”</strong>:</p>
      ${
        comment
          ? `<blockquote style="margin:16px 0;padding:12px 16px;background:#f4f6ff;border-left:4px solid #3b4cca;white-space:pre-wrap">${escapeHtml(comment)}</blockquote>`
          : ''
      }
      <p><a href="${escapeHtml(link)}"
            style="display:inline-block;background:#3b4cca;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">
         Read and reply</a></p>
      <p style="color:#6c757d;font-size:13px">Book Circle</p>
    </div>`

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || SMTP_USER,
      to,
      subject,
      text,
      html,
    })
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('notify: could not send email', err && err.message)
    return res.status(502).json({ error: 'Could not send email' })
  }
}

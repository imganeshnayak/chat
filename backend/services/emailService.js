import nodemailer from 'nodemailer';

// Gmail transporter using App Password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password (16-char, no spaces)
  },
});

// Verify connection on startup
transporter.verify((err) => {
  if (err) {
    console.error('❌ Email service error:', err.message);
  } else {
    console.log('✅ Email service ready:', process.env.EMAIL_USER);
  }
});

/**
 * Generate a 6-digit OTP
 */
export function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP email for registration
 */
export async function sendRegistrationOtp(email, otp) {
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0f0f0f; border-radius: 16px; overflow: hidden; border: 1px solid #2a2a2a;">
      <div style="background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; letter-spacing: -0.5px;">✨ Krovaa</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Secure Messaging Platform</p>
      </div>
      <div style="padding: 32px;">
        <h2 style="color: #ffffff; margin: 0 0 8px; font-size: 20px;">Verify Your Email</h2>
        <p style="color: #9ca3af; margin: 0 0 24px; font-size: 14px; line-height: 1.6;">
          Use the OTP below to complete your registration. It expires in <strong style="color: #a78bfa;">10 minutes</strong>.
        </p>
        <div style="background: #1a1a1a; border: 2px dashed #7c3aed; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px;">
          <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 2px;">Your OTP Code</p>
          <p style="color: #a78bfa; font-size: 42px; font-weight: 800; margin: 0; letter-spacing: 12px; font-family: monospace;">${otp}</p>
        </div>
        <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
          If you didn't request this, please ignore this email.
        </p>
      </div>
      <div style="background: #0a0a0a; padding: 16px; text-align: center; border-top: 1px solid #1f1f1f;">
        <p style="color: #4b5563; font-size: 11px; margin: 0;">© 2026 Krovaa · ${process.env.EMAIL_USER}</p>
      </div>
    </div>`;

  await transporter.sendMail({
    from: `"Krovaa" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `${otp} is your Krovaa verification code`,
    html,
  });
  console.log(`✉️ Registration OTP sent to ${email}`);
}

/**
 * Send OTP email for password reset
 */
export async function sendPasswordResetOtp(email, otp) {
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0f0f0f; border-radius: 16px; overflow: hidden; border: 1px solid #2a2a2a;">
      <div style="background: linear-gradient(135deg, #dc2626, #7c3aed); padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; letter-spacing: -0.5px;">✨ Krovaa</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Password Reset</p>
      </div>
      <div style="padding: 32px;">
        <h2 style="color: #ffffff; margin: 0 0 8px; font-size: 20px;">Reset Your Password</h2>
        <p style="color: #9ca3af; margin: 0 0 24px; font-size: 14px; line-height: 1.6;">
          Use the OTP below to reset your password. It expires in <strong style="color: #f87171;">10 minutes</strong>.
        </p>
        <div style="background: #1a1a1a; border: 2px dashed #dc2626; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px;">
          <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 2px;">Reset Code</p>
          <p style="color: #f87171; font-size: 42px; font-weight: 800; margin: 0; letter-spacing: 12px; font-family: monospace;">${otp}</p>
        </div>
        <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
          If you didn't request a password reset, please ignore this email and your account is safe.
        </p>
      </div>
      <div style="background: #0a0a0a; padding: 16px; text-align: center; border-top: 1px solid #1f1f1f;">
        <p style="color: #4b5563; font-size: 11px; margin: 0;">© 2026 Krovaa · ${process.env.EMAIL_USER}</p>
      </div>
    </div>`;

  await transporter.sendMail({
    from: `"Krovaa" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `${otp} is your Krovaa password reset code`,
    html,
  });
  console.log(`✉️ Password reset OTP sent to ${email}`);
}

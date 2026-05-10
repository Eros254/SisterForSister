/* =======================================================
   api/mpesa-status.js — Vercel Serverless Function
   Polls Daraja to check if STK Push was completed

   Environment Variables (set in Vercel Dashboard):
     MPESA_CONSUMER_KEY     → from Daraja app
     MPESA_CONSUMER_SECRET  → from Daraja app
     MPESA_TILL_NUMBER      → 855893 (your Till)
     MPESA_PASSKEY          → from Safaricom on Go-Live
     MPESA_ENV              → "sandbox" or "production"
   ======================================================= */

export default async function handler(req, res) {

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ref } = req.query;

  if (!ref) {
    return res.status(400).json({ error: 'Missing ref parameter' });
  }

  const {
    MPESA_CONSUMER_KEY,
    MPESA_CONSUMER_SECRET,
    MPESA_TILL_NUMBER,
    MPESA_PASSKEY,
    MPESA_ENV,
  } = process.env;

  const BASE_URL = MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

  try {
    // ── Get fresh OAuth token ──
    const authRes = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64'),
      },
    });

    if (!authRes.ok) {
      return res.status(502).json({ error: 'Failed to authenticate with Safaricom' });
    }

    const { access_token } = await authRes.json();

    // ── Query STK Push status ──
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const password  = Buffer.from(`${MPESA_TILL_NUMBER}${MPESA_PASSKEY}${timestamp}`).toString('base64');

    const queryRes = await fetch(`${BASE_URL}/mpesa/stkpushquery/v1/query`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: MPESA_TILL_NUMBER,
        Password:          password,
        Timestamp:         timestamp,
        CheckoutRequestID: ref,
      }),
    });

    const data = await queryRes.json();

    // ResultCode 0 = success, 1032 = cancelled, 1037 = timeout, 17 = limit exceeded
    if (data.ResultCode === '0' || data.ResultCode === 0) {
      return res.status(200).json({ status: 'success' });
    } else if (['1032', '1037', '1', '17'].includes(String(data.ResultCode))) {
      return res.status(200).json({
        status:  'failed',
        message: data.ResultDesc || 'Payment was not completed',
      });
    } else {
      // Still pending (ResultCode not yet set or processing)
      return res.status(200).json({ status: 'pending' });
    }

  } catch (err) {
    console.error('mpesa-status error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
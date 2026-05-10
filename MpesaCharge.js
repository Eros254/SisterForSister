/* =======================================================
   api/mpesa-charge.js — Vercel Serverless Function
   Triggers M-Pesa STK Push to donor's phone

   Environment Variables (set in Vercel Dashboard):
     MPESA_CONSUMER_KEY     → from Daraja app
     MPESA_CONSUMER_SECRET  → from Daraja app
     MPESA_TILL_NUMBER      → 855893 (your Till)
     MPESA_PASSKEY          → from Safaricom on Go-Live
     MPESA_ENV              → "sandbox" or "production"
   ======================================================= */

export default async function handler(req, res) {

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, phone, amount } = req.body;

  // Validate inputs
  if (!phone || !amount || !email) {
    return res.status(400).json({ error: 'Missing required fields: phone, email, amount' });
  }
  if (!/^2547\d{8}$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone number format. Expected 2547XXXXXXXX' });
  }
  if (amount < 1) {
    return res.status(400).json({ error: 'Amount must be at least KES 1' });
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
    // ── STEP 1: Get OAuth access token ──
    const authRes = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64'),
      },
    });

    if (!authRes.ok) {
      const err = await authRes.text();
      console.error('Daraja auth failed:', err);
      return res.status(502).json({ error: 'Failed to authenticate with Safaricom' });
    }

    const { access_token } = await authRes.json();

    // ── STEP 2: Build STK Push payload ──
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    // Password = Base64(ShortCode + Passkey + Timestamp)
    const password  = Buffer.from(`${MPESA_TILL_NUMBER}${MPESA_PASSKEY}${timestamp}`).toString('base64');
    const reference = `SFS-${Date.now()}`;

    const stkPayload = {
      BusinessShortCode: MPESA_TILL_NUMBER,
      Password:          password,
      Timestamp:         timestamp,
      TransactionType:   'CustomerBuyGoodsOnline',  // ← for Till numbers
      Amount:            Math.ceil(amount),          // must be whole number
      PartyA:            phone,
      PartyB:            MPESA_TILL_NUMBER,
      PhoneNumber:       phone,
      CallBackURL:       'https://your-vercel-domain.vercel.app/api/mpesa-callback',
      AccountReference:  reference,
      TransactionDesc:   `Donation - Sister For Sister Kenya`,
    };

    // ── STEP 3: Send STK Push ──
    const stkRes = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stkPayload),
    });

    const stkData = await stkRes.json();

    if (stkData.ResponseCode === '0') {
      // STK push sent successfully
      return res.status(200).json({
        success:   true,
        reference: stkData.CheckoutRequestID,
        message:   'Payment prompt sent to phone',
      });
    } else {
      console.error('STK Push failed:', stkData);
      return res.status(400).json({
        error: stkData.errorMessage || stkData.ResponseDescription || 'STK Push failed',
      });
    }

  } catch (err) {
    console.error('mpesa-charge error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
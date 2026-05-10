/* =======================================================
   api/flutterwave.js — Vercel Serverless Function
   Verifies Flutterwave payment after redirect

   Environment Variables (set in Vercel Dashboard):
     FLW_SECRET_KEY  → from Flutterwave Dashboard
                       Settings → API Keys → Secret Key
   ======================================================= */

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transaction_id, tx_ref, amount, currency } = req.body;

  if (!transaction_id) {
    return res.status(400).json({ error: 'Missing transaction_id' });
  }

  const { FLW_SECRET_KEY } = process.env;

  try {
    // Verify the transaction with Flutterwave
    const verifyRes = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
      {
        method: 'GET',
        headers: {
          Authorization:  `Bearer ${FLW_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!verifyRes.ok) {
      return res.status(502).json({ error: 'Failed to reach Flutterwave' });
    }

    const result = await verifyRes.json();
    const txData = result.data;

    // Validate: status must be successful and amount must match
    if (
      result.status  === 'success'     &&
      txData.status  === 'successful'  &&
      txData.tx_ref  === tx_ref        &&
      txData.amount  >= amount         &&
      txData.currency === (currency || 'KES')
    ) {
      return res.status(200).json({
        success:   true,
        reference: txData.flw_ref,
        amount:    txData.amount,
        currency:  txData.currency,
        name:      txData.customer?.name,
        email:     txData.customer?.email,
      });
    } else {
      return res.status(400).json({
        success: false,
        error:   'Payment verification failed — amount or status mismatch',
      });
    }

  } catch (err) {
    console.error('flutterwave verify error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
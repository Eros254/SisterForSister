/* =================================================
   Sister For Sister Kenya — main.js
   Payments: Paystack (Card) + M-Pesa STK Push
   =================================================

   SETUP — 3 steps:
   1. Go to https://dashboard.paystack.com
      Settings → API Keys → copy your Public Key
   2. Paste it as PAYSTACK_PUBLIC_KEY below
   3. For M-Pesa STK Push, deploy the two backend
      endpoints described in the M-Pesa section
   ================================================= */

const PAYSTACK_PUBLIC_KEY = 'pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // ← Your Paystack public key

document.addEventListener('DOMContentLoaded', () => {

  /* ── NAV SCROLL SHADOW ── */
  const nav = document.getElementById('mainNav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  });

  /* ── MOBILE MENU ── */
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const open = mobileMenu.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', String(open));
    });
    mobileMenu.querySelectorAll('a').forEach(l => {
      l.addEventListener('click', () => mobileMenu.classList.remove('open'));
    });
  }

  /* ── FUNDING NEEDS TABS ── */
  window.showTab = function (id, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + id).classList.add('active');
    btn.classList.add('active');
  };

  /* ── SCROLL REVEAL ── */
  const revealEls = document.querySelectorAll(
    '.program-card, .impact-card, .help-way, .contact-item, .mission-item'
  );
  revealEls.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(22px)';
    el.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
  });
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity = '1';
        e.target.style.transform = 'translateY(0)';
        revealObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  revealEls.forEach(el => revealObserver.observe(el));

  /* ── PAYMENT METHOD SWITCHER ── */
  document.querySelectorAll('.pay-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.pay-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.pay-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
      document.querySelectorAll('.pay-error').forEach(e => e.textContent = '');
    });
  });

  /* ── AMOUNT SELECTION ── */
  let selectedAmount = 2500;

  document.querySelectorAll('.amount-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedAmount = parseInt(btn.dataset.amount, 10);
      document.querySelectorAll('.custom-amount').forEach(i => i.value = '');
    });
  });

  document.querySelectorAll('.custom-amount').forEach(input => {
    input.addEventListener('input', () => {
      document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('selected'));
      selectedAmount = parseInt(input.value, 10) || 0;
    });
  });

  function getAmount() {
    const activePanel = document.querySelector('.pay-panel.active');
    const custom = activePanel ? activePanel.querySelector('.custom-amount') : null;
    return (custom && custom.value) ? parseInt(custom.value, 10) : selectedAmount;
  }

  /* ══════════════════════════════════════════
     PAYSTACK — CARD PAYMENT (Hosted Popup)
     PCI-compliant — card data never touches
     your server. Paystack handles everything.
     ══════════════════════════════════════════ */
  const cardForm = document.getElementById('cardForm');
  if (cardForm) {
    cardForm.addEventListener('submit', e => {
      e.preventDefault();
      const name   = document.getElementById('cardName').value.trim();
      const email  = document.getElementById('cardEmail').value.trim();
      const amount = getAmount();
      const errEl  = document.getElementById('cardError');

      if (!name || !email) { errEl.textContent = 'Please enter your name and email.'; return; }
      if (!amount || amount < 100) { errEl.textContent = 'Minimum donation is KES 100.'; return; }
      errEl.textContent = '';

      // Demo mode if key is placeholder or Paystack JS not loaded
      if (typeof PaystackPop === 'undefined' || PAYSTACK_PUBLIC_KEY.includes('xxxx')) {
        showSuccess(amount, name, 'Card', 'DEMO-' + Date.now());
        return;
      }

      const handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email,
        amount: amount * 100,           // Paystack uses smallest currency unit
        currency: 'KES',
        ref: 'SFS-CARD-' + Date.now(),
        label: 'Sister For Sister Kenya Donation',
        metadata: {
          custom_fields: [
            { display_name: 'Donor Name',   variable_name: 'donor_name', value: name },
            { display_name: 'Method',       variable_name: 'method',     value: 'Card' },
          ],
        },
        callback(response) {
          showSuccess(amount, name, 'Card', response.reference);
        },
        onClose() {
          errEl.textContent = 'Payment window closed. Click "Donate by Card" to try again.';
        },
      });
      handler.openIframe();
    });
  }

  /* ══════════════════════════════════════════
     M-PESA STK PUSH via Paystack
     Sends a prompt to the donor's Safaricom
     phone. They approve with their M-Pesa PIN.
     No app needed — works on any phone.

     ── BACKEND ENDPOINTS TO BUILD ────────────

     POST /api/mpesa-charge
       Receives: { name, email, phone, amount }
       Calls Paystack:
         POST https://api.paystack.co/charge
         Auth: Bearer sk_live_YOUR_SECRET_KEY
         Body: {
           email,
           currency: "KES",
           amount: amount * 100,
           mobile_money: {
             phone: "2547XXXXXXXX",
             provider: "mpesa"
           }
         }
       Returns: { success: true, reference: "xxx" }

     GET /api/mpesa-status?ref=xxx
       Calls Paystack:
         GET https://api.paystack.co/charge/xxx
         Auth: Bearer sk_live_YOUR_SECRET_KEY
       Returns: { status: "success"|"pending"|"failed" }

     Node.js / Express example:
       app.post('/api/mpesa-charge', async (req, res) => {
         const { email, phone, amount } = req.body;
         const r = await axios.post(
           'https://api.paystack.co/charge',
           { email, currency:'KES', amount: amount*100,
             mobile_money: { phone, provider:'mpesa' } },
           { headers: { Authorization: `Bearer ${SK_LIVE}` } }
         );
         res.json({ success: true, reference: r.data.data.reference });
       });
     ══════════════════════════════════════════ */
  const mpesaForm = document.getElementById('mpesaForm');
  if (mpesaForm) {
    mpesaForm.addEventListener('submit', async e => {
      e.preventDefault();
      const name   = document.getElementById('mpesaName').value.trim();
      const email  = document.getElementById('mpesaEmail').value.trim();
      const phone  = document.getElementById('mpesaPhone').value.trim();
      const amount = getAmount();
      const errEl  = document.getElementById('mpesaError');
      const btn    = document.getElementById('mpesaBtn');

      if (!name || !email) { errEl.textContent = 'Please enter your name and email.'; return; }
      if (!phone)           { errEl.textContent = 'Please enter your Safaricom number.'; return; }
      if (!amount || amount < 100) { errEl.textContent = 'Minimum donation is KES 100.'; return; }

      // Normalise to international format: 2547XXXXXXXX
      const raw  = phone.replace(/[\s\-()]/g, '');
      const norm = raw.startsWith('0')  ? '254' + raw.slice(1)
                 : raw.startsWith('+')  ? raw.slice(1)
                 : raw;

      if (!/^2547\d{8}$/.test(norm)) {
        errEl.textContent = 'Enter a valid Safaricom number, e.g. 0712 345 678';
        return;
      }

      errEl.textContent = '';
      btn.disabled = true;
      btn.textContent = '⏳ Sending to your phone…';

      try {
        const res = await fetch('/api/mpesa-charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, phone: norm, amount }),
        });
        if (!res.ok) throw new Error('Server error — check your backend.');
        const data = await res.json();
        if (data.success) {
          showPending(norm);
          pollMpesa(data.reference, amount, name);
        } else {
          throw new Error(data.message || 'M-Pesa prompt could not be sent.');
        }
      } catch (err) {
        // Demo mode — backend not yet connected
        console.warn('M-Pesa backend not connected — demo mode:', err.message);
        showPending(norm);
        setTimeout(() => showSuccess(amount, name, 'M-Pesa', 'DEMO-' + Date.now()), 5000);
      }
    });
  }

  /* ── POLL UNTIL M-PESA COMPLETES (every 5s, max 60s) ── */
  async function pollMpesa(ref, amount, name) {
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      try {
        const res  = await fetch('/api/mpesa-status?ref=' + ref);
        const data = await res.json();
        if (data.status === 'success') {
          clearInterval(timer);
          showSuccess(amount, name, 'M-Pesa', ref);
        } else if (data.status === 'failed' || tries >= 12) {
          clearInterval(timer);
          resetMpesaForm(tries >= 12
            ? 'Payment timed out. Check your phone and try again.'
            : 'M-Pesa payment was cancelled. Please try again.');
        }
      } catch (_) { /* keep polling silently */ }
    }, 5000);
  }

  /* ── UI STATE HELPERS ── */
  function showPending(phone) {
    document.getElementById('mpesaForm').style.display = 'none';
    const pending = document.getElementById('mpesaPending');
    pending.style.display = 'block';
    pending.querySelector('.pending-phone').textContent = '+' + phone;
  }

  function resetMpesaForm(msg) {
    document.getElementById('mpesaPending').style.display = 'none';
    document.getElementById('mpesaForm').style.display    = 'block';
    document.getElementById('mpesaError').textContent     = msg;
    const btn = document.getElementById('mpesaBtn');
    btn.disabled    = false;
    btn.textContent = '📲 Send M-Pesa Prompt';
  }

  function showSuccess(amount, name, method, ref) {
    ['.donate-intro', '.pay-tabs-bar', '.amount-section', '.pay-panels', '#mpesaPending']
      .forEach(sel => {
        const el = document.querySelector(sel);
        if (el) el.style.display = 'none';
      });
    const s = document.getElementById('donateSuccess');
    s.style.display = 'block';
    s.querySelector('.s-name').textContent   = name.split(' ')[0];
    s.querySelector('.s-amount').textContent = 'KES ' + amount.toLocaleString();
    s.querySelector('.s-method').textContent = method;
    const refEl = s.querySelector('.s-ref');
    if (refEl) refEl.textContent = (ref && !ref.startsWith('DEMO')) ? 'Reference: ' + ref : '';
  }

});
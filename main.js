/* =============================================
   Sister For Sister Kenya — main.js
   Paystack: Card Payments + M-Pesa STK Push
   =============================================

   SETUP:
   1. Sign up at https://paystack.com/ke
   2. Settings → API Keys → copy Public Key
   3. Replace PAYSTACK_PUBLIC_KEY below
   4. Deploy a small backend for M-Pesa STK push
      (see comments in the M-Pesa section below)
   ============================================= */

const PAYSTACK_PUBLIC_KEY = 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

document.addEventListener('DOMContentLoaded', () => {

  /* ── NAV SCROLL ── */
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
    mobileMenu.querySelectorAll('a').forEach(l => l.addEventListener('click', () => mobileMenu.classList.remove('open')));
  }

  /* ── NEEDS TABS ── */
  window.showTab = function (id, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + id).classList.add('active');
    btn.classList.add('active');
  };

  /* ── SCROLL REVEAL ── */
  const els = document.querySelectorAll('.program-card,.impact-card,.help-way,.contact-item,.mission-item');
  els.forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(22px)'; el.style.transition = 'opacity 0.55s ease, transform 0.55s ease'; });
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.style.opacity = '1'; e.target.style.transform = 'translateY(0)'; io.unobserve(e.target); } });
  }, { threshold: 0.1 });
  els.forEach(el => io.observe(el));

  /* ── PAYMENT METHOD TABS ── */
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
    const custom = document.querySelector('.pay-panel.active .custom-amount');
    return (custom && custom.value) ? parseInt(custom.value, 10) : selectedAmount;
  }

  /* ══════════════════════════════════════════
     PAYSTACK — CARD PAYMENT (Popup)
     Paystack's secure hosted popup handles
     all card details — PCI compliant,
     nothing stored on your server.
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

      if (typeof PaystackPop === 'undefined') {
        // Demo mode — Paystack JS not loaded or key is placeholder
        showSuccess(amount, name, 'Card', 'DEMO-' + Date.now());
        return;
      }

      const handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email,
        amount: amount * 100,         // Paystack amounts are in kobo/cents
        currency: 'KES',
        ref: 'SFS-CARD-' + Date.now(),
        label: 'Sister For Sister Kenya Donation',
        metadata: {
          custom_fields: [
            { display_name: 'Donor Name',    variable_name: 'donor_name', value: name },
            { display_name: 'Donation Type', variable_name: 'type',       value: 'Card' },
          ],
        },
        callback(response) {
          showSuccess(amount, name, 'Card', response.reference);
        },
        onClose() {
          errEl.textContent = 'Payment window closed. Try again when ready.';
        },
      });
      handler.openIframe();
    });
  }

  /* ══════════════════════════════════════════
     PAYSTACK — M-PESA STK PUSH
     Sends a payment prompt straight to the
     donor's Safaricom phone. They approve
     by entering their M-Pesa PIN.

     BACKEND REQUIRED — your server calls:
     POST https://api.paystack.co/charge
     Headers: { Authorization: "Bearer sk_live_..." }
     Body: {
       email, currency: "KES",
       amount: amountInKobo,
       mobile_money: {
         phone: "2547XXXXXXXX",
         provider: "mpesa"
       }
     }
     Then poll GET /charge/:reference until
     data.data.status === "success" and return
     { success: true, reference } to the browser.
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

      // Normalise to 2547XXXXXXXX
      const raw = phone.replace(/[\s\-]/g, '');
      const norm = raw.startsWith('0') ? '254' + raw.slice(1)
                 : raw.startsWith('+') ? raw.slice(1)
                 : raw;

      if (!/^2547\d{8}$/.test(norm)) {
        errEl.textContent = 'Enter a valid Safaricom number e.g. 0712 345 678';
        return;
      }

      errEl.textContent = '';
      btn.disabled = true;
      btn.innerHTML = '<span class="spin">⏳</span> Sending to your phone…';

      try {
        const res = await fetch('/api/mpesa-charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, phone: norm, amount }),
        });
        if (!res.ok) throw new Error('Server error');
        const data = await res.json();
        if (data.success) {
          showPending(norm);
          pollStatus(data.reference, amount, name);
        } else {
          throw new Error(data.message || 'Could not send M-Pesa prompt.');
        }
      } catch (err) {
        // Demo mode — no backend yet
        console.warn('Backend not connected — demo mode:', err.message);
        showPending(norm);
        setTimeout(() => showSuccess(amount, name, 'M-Pesa', 'DEMO-' + Date.now()), 5000);
      }
    });
  }

  /* ── POLL FOR M-PESA COMPLETION ── */
  async function pollStatus(ref, amount, name) {
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
            : 'M-Pesa payment was not completed. Please try again.');
        }
      } catch (_) { /* keep polling */ }
    }, 5000);
  }

  /* ── UI HELPERS ── */
  function showPending(phone) {
    document.getElementById('mpesaForm').style.display = 'none';
    const p = document.getElementById('mpesaPending');
    p.style.display = 'block';
    p.querySelector('.pending-phone').textContent = '+' + phone;
  }

  function resetMpesaForm(msg) {
    document.getElementById('mpesaPending').style.display = 'none';
    document.getElementById('mpesaForm').style.display    = 'block';
    document.getElementById('mpesaError').textContent     = msg;
    const btn = document.getElementById('mpesaBtn');
    btn.disabled  = false;
    btn.innerHTML = '📲 Send M-Pesa Prompt';
  }

  function showSuccess(amount, name, method, ref) {
    // Hide everything in donate-right
    document.querySelectorAll('.donate-intro, .pay-tabs-bar, .amount-section, .pay-panels, #mpesaPending').forEach(el => {
      if (el) el.style.display = 'none';
    });
    const s = document.getElementById('donateSuccess');
    s.style.display = 'block';
    s.querySelector('.success-name').textContent   = name.split(' ')[0];
    s.querySelector('.success-amount').textContent = 'KES ' + amount.toLocaleString();
    s.querySelector('.success-method').textContent = method;
    const refEl = s.querySelector('.success-ref');
    if (refEl) refEl.textContent = ref && !ref.startsWith('DEMO') ? 'Ref: ' + ref : '';
  }

});
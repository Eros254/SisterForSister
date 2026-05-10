/* =================================================
   Sister For Sister Kenya — main.js
   Payments:
     • M-Pesa STK Push (via Daraja API / Vercel)
     • Flutterwave (Card / diaspora donors)
   ================================================= */

/* ── Flutterwave Public Key ──
   Safe to put here (public key only).
   Get it from: Flutterwave Dashboard → Settings → API Keys
   Replace the placeholder below once you have it.        */
const FLW_PUBLIC_KEY = 'FLWPUBK-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-X'; // ← Your Flutterwave public key

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

  /* ── AMOUNT SELECTION (shared) ── */
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

  /* ══════════════════════════════════════════════
     M-PESA STK PUSH
     Calls /api/mpesa-charge (Vercel serverless).
     That function uses your Daraja credentials
     (stored safely as Vercel env vars) to send
     a payment prompt to the donor's phone.
     ══════════════════════════════════════════════ */
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

      // Validate
      if (!name || !email) { errEl.textContent = 'Please enter your name and email.'; return; }
      if (!phone)           { errEl.textContent = 'Please enter your Safaricom number.'; return; }
      if (!amount || amount < 1) { errEl.textContent = 'Please select or enter an amount.'; return; }

      // Normalise phone → 2547XXXXXXXX
      const raw  = phone.replace(/[\s\-()]/g, '');
      const norm = raw.startsWith('0')  ? '254' + raw.slice(1)
                 : raw.startsWith('+')  ? raw.slice(1)
                 : raw;

      if (!/^2547\d{8}$/.test(norm)) {
        errEl.textContent = 'Enter a valid Safaricom number e.g. 0712 345 678';
        return;
      }

      errEl.textContent = '';
      btn.disabled = true;
      btn.textContent = '⏳ Sending to your phone…';

      try {
        const res = await fetch('/api/mpesa-charge', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ name, email, phone: norm, amount }),
        });

        const data = await res.json();

        if (data.success) {
          showMpesaPending(norm);
          pollMpesa(data.reference, amount, name);
        } else {
          errEl.textContent = data.error || 'Could not send M-Pesa prompt. Try again.';
          btn.disabled = false;
          btn.textContent = '📲 Send M-Pesa Prompt';
        }

      } catch (err) {
        // Demo mode — API not yet connected
        console.warn('M-Pesa API not connected — demo mode:', err.message);
        showMpesaPending(norm);
        setTimeout(() => showSuccess(amount, name, 'M-Pesa', 'DEMO-' + Date.now()), 5000);
      }
    });
  }

  /* ── Poll until M-Pesa payment completes (every 5s, max 60s) ── */
  async function pollMpesa(ref, amount, name) {
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      try {
        const res  = await fetch('/api/mpesa-status?ref=' + encodeURIComponent(ref));
        const data = await res.json();

        if (data.status === 'success') {
          clearInterval(timer);
          showSuccess(amount, name, 'M-Pesa', ref);
        } else if (data.status === 'failed' || tries >= 12) {
          clearInterval(timer);
          resetMpesaForm(tries >= 12
            ? 'Payment timed out. Please check your phone and try again.'
            : data.message || 'M-Pesa payment was not completed. Please try again.');
        }
        // else: still pending — keep polling
      } catch (_) { /* keep polling silently */ }
    }, 5000);
  }

  function showMpesaPending(phone) {
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

  /* ══════════════════════════════════════════════
     FLUTTERWAVE — CARD / DIASPORA PAYMENTS
     Uses Flutterwave's hosted payment modal.
     Accepts: Visa, Mastercard, M-Pesa, Bank Transfer.
     Great for international / diaspora donors.

     After payment, Flutterwave redirects back and
     /api/flutterwave verifies the transaction
     using your secret key (stored in Vercel env).
     ══════════════════════════════════════════════ */
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

      // Demo mode if key is still placeholder
      if (FLW_PUBLIC_KEY.includes('xxxx') || typeof FlutterwaveCheckout === 'undefined') {
        showSuccess(amount, name, 'Card', 'DEMO-FLW-' + Date.now());
        return;
      }

      // Open Flutterwave modal
      FlutterwaveCheckout({
        public_key:  FLW_PUBLIC_KEY,
        tx_ref:      'SFS-FLW-' + Date.now(),
        amount,
        currency:    'KES',
        payment_options: 'card, mpesa, banktransfer',
        customer: { email, name },
        customizations: {
          title:       'Sister For Sister Kenya',
          description: 'Empowering the girl child across Kenya',
          logo:        window.location.origin + '/Images/logo.jpg',
        },
        callback(response) {
          if (response.status === 'successful') {
            // Verify on backend
            fetch('/api/flutterwave', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({
                transaction_id: response.transaction_id,
                tx_ref:         response.tx_ref,
                amount,
                currency:       'KES',
              }),
            })
            .then(r => r.json())
            .then(data => {
              if (data.success) {
                showSuccess(amount, name, 'Card', response.flw_ref);
              } else {
                errEl.textContent = 'Payment received but verification failed. Contact us with your reference: ' + response.flw_ref;
              }
            })
            .catch(() => {
              // If verify fails but payment went through, still show success
              showSuccess(amount, name, 'Card', response.flw_ref);
            });
          }
        },
        onclose() {
          errEl.textContent = 'Payment window closed. Click "Donate by Card" to try again.';
        },
      });
    });
  }

  /* ── SHARED SUCCESS STATE ── */
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
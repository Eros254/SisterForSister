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
  let givingMode = 'once';
  const selectedAmounts = { mpesa: 2500, card: 25 };

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
    '.program-card, .impact-card, .help-way, .contact-item, .mission-item, .story-card, .article-card'
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
      updateGivingModeNote();
    });
  });

  /* ── GIVING MODE ── */
  const givingModeNote = document.getElementById('givingModeNote');
  document.querySelectorAll('.giving-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.giving-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      givingMode = btn.dataset.mode;
      document.querySelectorAll('.pay-error').forEach(e => e.textContent = '');
      updateGivingModeNote();
    });
  });

  function getActivePanelKey() {
    const activePanel = document.querySelector('.pay-panel.active');
    return activePanel ? activePanel.id.replace('panel-', '') : 'mpesa';
  }

  function updateGivingModeNote() {
    if (!givingModeNote) return;
    const activePanel = getActivePanelKey();
    if (givingMode === 'monthly') {
      givingModeNote.textContent = activePanel === 'card'
        ? 'Monthly giving is being prepared for final recurring payment integration. For now, you can choose Give Once or contact the team to register monthly support.'
        : 'Monthly M-Pesa giving can be arranged with our team while automated recurring payments are being finalized.';
      return;
    }

    givingModeNote.textContent = activePanel === 'card'
      ? 'Make a one-time USD gift using an international card to support immediate program and operational needs.'
      : 'Make a one-time M-Pesa gift today to meet immediate needs in the communities we serve.';
  }

  /* ── AMOUNT SELECTION (per payment panel) ── */
  document.querySelectorAll('.amount-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.panel;
      document.querySelectorAll(`.amount-btn[data-panel="${panel}"]`).forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedAmounts[panel] = parseFloat(btn.dataset.amount);
      const input = document.querySelector(`.custom-amount[data-panel="${panel}"]`);
      if (input) input.value = '';
    });
  });

  document.querySelectorAll('.custom-amount').forEach(input => {
    input.addEventListener('input', () => {
      const panel = input.dataset.panel;
      document.querySelectorAll(`.amount-btn[data-panel="${panel}"]`).forEach(b => b.classList.remove('selected'));
      selectedAmounts[panel] = parseFloat(input.value) || 0;
    });
  });

  function getAmount() {
    const panel = getActivePanelKey();
    const activePanel = document.querySelector('.pay-panel.active');
    const custom = activePanel ? activePanel.querySelector('.custom-amount') : null;
    return (custom && custom.value) ? parseFloat(custom.value) : (selectedAmounts[panel] || 0);
  }

  function getCurrency() {
    return getActivePanelKey() === 'card' ? 'USD' : 'KES';
  }

  function formatAmount(amount, currency) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'KES' ? 0 : 0,
    }).format(amount);
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
      if (givingMode === 'monthly') {
        errEl.textContent = 'Monthly M-Pesa giving will be confirmed with our team while recurring payments are being finalized. Please contact us to set it up.';
        return;
      }
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
          body:    JSON.stringify({ name, email, phone: norm, amount, frequency: givingMode }),
        });

        const data = await res.json();

        if (data.success) {
          showMpesaPending(norm);
          pollMpesa(data.reference, amount, name, 'KES');
        } else {
          errEl.textContent = data.error || 'Could not send M-Pesa prompt. Try again.';
          btn.disabled = false;
          btn.textContent = '📲 Send M-Pesa Prompt';
        }

      } catch (err) {
        // Demo mode — API not yet connected
        console.warn('M-Pesa API not connected — demo mode:', err.message);
        showMpesaPending(norm);
        setTimeout(() => showSuccess(amount, name, 'M-Pesa', 'KES', 'DEMO-' + Date.now()), 5000);
      }
    });
  }

  /* ── Poll until M-Pesa payment completes (every 5s, max 60s) ── */
  async function pollMpesa(ref, amount, name, currency) {
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      try {
        const res  = await fetch('/api/mpesa-status?ref=' + encodeURIComponent(ref));
        const data = await res.json();

        if (data.status === 'success') {
          clearInterval(timer);
          showSuccess(amount, name, 'M-Pesa', currency, ref);
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
      const currency = getCurrency();
      const errEl  = document.getElementById('cardError');

      if (givingMode === 'monthly') {
        errEl.textContent = 'Monthly card giving will be activated when the final recurring payment platform is connected. Please contact us to register your interest.';
        return;
      }
      if (!name || !email) { errEl.textContent = 'Please enter your name and email.'; return; }
      if (!amount || amount < 5) { errEl.textContent = 'Minimum international card donation is $5.'; return; }
      errEl.textContent = '';

      // Demo mode if key is still placeholder
      if (FLW_PUBLIC_KEY.includes('xxxx') || typeof FlutterwaveCheckout === 'undefined') {
        showSuccess(amount, name, 'Card', currency, 'DEMO-FLW-' + Date.now());
        return;
      }

      // Open Flutterwave modal
      FlutterwaveCheckout({
        public_key:  FLW_PUBLIC_KEY,
        tx_ref:      'SFS-FLW-' + Date.now(),
        amount,
        currency,
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
                currency,
              }),
            })
            .then(r => r.json())
            .then(data => {
              if (data.success) {
                showSuccess(amount, name, 'Card', currency, response.flw_ref);
              } else {
                errEl.textContent = 'Payment received but verification failed. Contact us with your reference: ' + response.flw_ref;
              }
            })
            .catch(() => {
              // If verify fails but payment went through, still show success
              showSuccess(amount, name, 'Card', currency, response.flw_ref);
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
  function showSuccess(amount, name, method, currency, ref) {
    ['.donate-intro', '.pay-tabs-bar', '.amount-section', '.pay-panels', '#mpesaPending']
      .forEach(sel => {
        const el = document.querySelector(sel);
        if (el) el.style.display = 'none';
      });

    const s = document.getElementById('donateSuccess');
    s.style.display = 'block';
    s.querySelector('.s-name').textContent   = name.split(' ')[0];
    s.querySelector('.s-amount').textContent = formatAmount(amount, currency);
    s.querySelector('.s-method').textContent = method;
    const refEl = s.querySelector('.s-ref');
    if (refEl) refEl.textContent = (ref && !ref.startsWith('DEMO')) ? 'Reference: ' + ref : '';
  }

  updateGivingModeNote();
});

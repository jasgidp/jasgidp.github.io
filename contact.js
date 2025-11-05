(() => {
  let contactData = null;

  async function loadData() {
    try {
      const res = await fetch('data/contact.json');
      if (!res.ok) throw new Error('Failed to load contact.json');
      contactData = await res.json();
      render();
    } catch (err) {
      console.error(err);
    }
  }

  function label(key, fallback) {
    return (window.t ? window.t(key, fallback) : fallback);
  }

  function render() {
    if (!contactData) return;
    const { headline, subheadline, email, phone, location, address, availability, socials, form } = contactData;

    const headlineEl = document.getElementById('contact-headline');
    const subheadlineEl = document.getElementById('contact-subheadline');
    if (headlineEl) headlineEl.textContent = headline || '';
    if (subheadlineEl) subheadlineEl.textContent = subheadline || '';

    const infoEl = document.getElementById('contact-info');
    if (infoEl) {
      const items = [];
      if (email) items.push({ key: 'contact.info.email', icon: 'ri-mail-line', label: label('contact.info.email', 'Email'), value: email });
      if (phone) items.push({ key: 'contact.info.phone', icon: 'ri-phone-line', label: label('contact.info.phone', 'Phone'), value: phone });
      if (location) items.push({ key: 'contact.info.location', icon: 'ri-map-pin-line', label: label('contact.info.location', 'Location'), value: location });
      if (address) items.push({ key: 'contact.info.address', icon: 'ri-home-2-line', label: label('contact.info.address', 'Address'), value: address });
      if (availability) items.push({ key: 'contact.info.availability', icon: 'ri-time-line', label: label('contact.info.availability', 'Availability'), value: availability });

      infoEl.innerHTML = items.map(it => `
        <li class="contact-fact">
          <i class="${it.icon}" aria-hidden="true"></i>
          <span class="label">${it.label}</span>
          <span class="value">${it.value}</span>
        </li>
      `).join('');
    }

    const socialsEl = document.getElementById('contact-socials');
    if (socialsEl) {
      socialsEl.innerHTML = (socials || []).map(s => `
        <a href="${s.url}" target="_blank" rel="noopener" class="social-link" aria-label="${s.name}">
          <i class="${s.icon || 'ri-link'}" aria-hidden="true"></i>
          <span>${s.name}</span>
        </a>
      `).join('');
    }

    const emailBtn = document.getElementById('email-cta');
    if (emailBtn && email) {
      const subject = encodeURIComponent((form && form.subject) || 'Hello');
      emailBtn.href = `mailto:${email}?subject=${subject}`;
      emailBtn.textContent = label('contact.emailCta', 'Send Email');
    }
  }

  // Simple demo form handling
  function setupForm() {
    const formEl = document.getElementById('contact-form');
    const statusEl = document.getElementById('form-status');
    if (!formEl) return;

    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(formEl);
      const data = Object.fromEntries(fd.entries());
      const name = (data.name || '').trim();
      const email = (data.email || '').trim();
      const subject = (data.subject || '').trim();
      const message = (data.message || '').trim();

      const invalidEmailMsg = label('contact.form.invalidEmail', 'Please enter a valid email.');
      const errorMsg = label('contact.form.error', 'Please fill in all required fields.');
      const successMsg = label('contact.form.success', 'Thanks! Your message was sent (demo).');

      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!name || !email || !message) {
        if (statusEl) statusEl.textContent = errorMsg;
        if (statusEl) statusEl.className = 'form-status error';
        return;
      }
      if (!emailOk) {
        if (statusEl) statusEl.textContent = invalidEmailMsg;
        if (statusEl) statusEl.className = 'form-status error';
        return;
      }

      // Demo: log payload and show success
      console.log('Contact form submission (demo):', { name, email, subject, message });
      if (statusEl) statusEl.textContent = successMsg;
      if (statusEl) statusEl.className = 'form-status success';
      formEl.reset();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupForm();
  });

  // Re-render labels when language changes
  document.addEventListener('i18n:updated', () => {
    render();
  });
})();

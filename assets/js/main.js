/* SVCS — shared behaviour: nav, scroll reveals, counters, modal, floats */
(function () {
  // mobile nav
  var hamb = document.getElementById('hamb');
  var navLinks = document.getElementById('navLinks');
  if (hamb && navLinks) {
    hamb.addEventListener('click', function () { navLinks.classList.toggle('open'); });
    navLinks.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { navLinks.classList.remove('open'); });
    });
  }

  // scroll reveal
  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }

  // animated counters  [data-count]
  document.querySelectorAll('[data-count]').forEach(function (el) {
    var target = Number(el.getAttribute('data-count')) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var started = false;
    function run() {
      if (started) return; started = true;
      var t0 = null;
      function tick(ts) {
        if (!t0) t0 = ts;
        var p = Math.min((ts - t0) / 1400, 1);
        el.textContent = Math.floor(target * (1 - Math.pow(1 - p, 3))) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
    if ('IntersectionObserver' in window) {
      var co = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) { if (en.isIntersecting) { run(); co.unobserve(en.target); } });
      }, { threshold: 0.4 });
      co.observe(el);
    } else { run(); }
  });

  // scroll top
  var scrollTopBtn = document.getElementById('scrollTop');
  if (scrollTopBtn) {
    window.addEventListener('scroll', function () {
      scrollTopBtn.classList.toggle('show', window.scrollY > 220);
    });
    scrollTopBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  // footer year
  var yr = document.getElementById('yearNow');
  if (yr) yr.textContent = new Date().getFullYear();

  // Terms modal: #terms hash ya [data-open-terms] se khulta hai
  var termsModal = document.getElementById('termsModal');
  function openTerms() {
    if (!termsModal) return;
    termsModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeTerms() {
    if (!termsModal) return;
    termsModal.classList.remove('open');
    document.body.style.overflow = '';
  }
  window.SVCS = window.SVCS || {};
  window.SVCS.openTerms = openTerms;
  window.SVCS.closeTerms = closeTerms;
  document.querySelectorAll('[data-open-terms]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      if (!termsModal || termsModal.innerHTML.trim() === '') { // is page pe poora modal nahi hai → idcard page pe jao
        window.location.href = 'idcard.html#terms';
        return;
      }
      openTerms();
    });
  });
  if (termsModal) {
    termsModal.querySelectorAll('[data-close-terms]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        if (window.SVCS.onTermsClosed) window.SVCS.onTermsClosed(true);
        closeTerms();
      });
    });
    termsModal.addEventListener('click', function (e) {
      if (e.target === termsModal && termsModal.getAttribute('data-required') !== '1') closeTerms();
    });
    if (window.location.hash === '#terms') openTerms();
  }

  /* ---- "khulte hi" ID Card सूचना popup — हर पेज खुलने पर (ID Card पेज को छोड़कर) ---- */
  var isIdcardPage = termsModal && termsModal.getAttribute('data-required') === '1';
  if (!isIdcardPage) {
    if (!termsModal) {
      termsModal = document.createElement('div');
      termsModal.id = 'termsModal';
      termsModal.className = 'modal-overlay';
      document.body.appendChild(termsModal);
    }
    if (!termsModal.innerHTML.trim()) {
      termsModal.innerHTML =
        '<div class="modal-box">' +
        '<h2>🪪 सदस्य ID Card — विशेष सूचना</h2>' +
        '<p style="font-size:.85rem">सामाजिक विकास चेतना समिति | नियम एवं शर्तें लागू</p>' +
        '<p>समिति के सदस्य अब अपना <strong>सदस्य पहचान पत्र (ID Card)</strong> ऑनलाइन बना सकते हैं:</p>' +
        '<ul><li>📷 फोटो + पूरा विवरण भरें (जैसे — Dinesh Singh)</li>' +
        '<li>💳 सुरक्षित UPI QR से सदस्यता शुल्क का भुगतान करें</li>' +
        '<li>📧 ID Card PDF आपके ईमेल पर; स्वीकृति के बाद हस्ताक्षरित प्रति</li></ul>' +
        '<h3>🔒 गोपनीयता / डेटा प्रोफाइलिंग</h3>' +
        '<p>आपकी फोटो, मोबाइल, ईमेल आदि केवल सदस्यता एवं ID Card हेतु सुरक्षित रूप से रखे जाते हैं — सार्वजनिक रूप से प्रदर्शित या साझा नहीं किए जाते।</p>' +
        '<div class="modal-actions">' +
        '<a class="btn btn-primary" href="idcard.html">🪪 ID Card Generate करें</a>' +
        '<button class="btn btn-ghost" data-close-terms>ठीक है, बाद में</button>' +
        '</div>' +
        '<p style="margin-top:12px"><a href="idcard.html#terms" style="color:var(--blue);text-decoration:underline;font-weight:700">पूरे नियम एवं शर्तें पढ़ें →</a></p>' +
        '</div>';
    }
    termsModal.querySelectorAll('[data-close-terms]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); closeTerms(); });
    });
    termsModal.addEventListener('click', function (e) {
      if (e.target === termsModal) closeTerms();
    });
    openTerms(); // khulte hi popup
  }
})();

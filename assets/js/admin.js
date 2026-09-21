/* SVCS — Admin portal: login, counts, application list, approve/reject, signed PDF email */
(function () {
  var C = window.SVCS_CONFIG;
  var session = null; // {user, pass}
  function $(id) { return document.getElementById(id); }
  function setF(k, v) { document.querySelectorAll('#signArea [data-f="' + k + '"]').forEach(function (el) { el.textContent = v; }); }

  if (!C.APPS_SCRIPT_URL) $('demoNote').style.display = 'block';

  /* ---------- data layer ---------- */
  function post(payload) {
    return fetch(C.APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) }).then(function (r) { return r.json(); });
  }
  function demoAll() { return JSON.parse(localStorage.getItem('svcs_apps') || '[]'); }
  function demoSaveAll(all) { localStorage.setItem('svcs_apps', JSON.stringify(all)); }

  function login(user, pass) {
    if (C.APPS_SCRIPT_URL) return post({ action: 'login', user: user, pass: pass });
    if (user === C.DEMO_USER && pass === C.DEMO_PASS) return Promise.resolve({ ok: true, demo: true });
    return Promise.resolve({ ok: false, error: 'गलत ID या पासवर्ड' });
  }
  function loadList() {
    if (C.APPS_SCRIPT_URL) return post({ action: 'list', user: session.user, pass: session.pass });
    return Promise.resolve({ ok: true, demo: true, rows: demoAll() });
  }
  function setStatus(id, status, remark) {
    if (C.APPS_SCRIPT_URL) return post({ action: 'status', user: session.user, pass: session.pass, id: id, status: status, remark: remark || '' });
    var all = demoAll();
    all.forEach(function (r) { if (r.id === id) { r.status = status; r.remark = remark || ''; } });
    demoSaveAll(all);
    return Promise.resolve({ ok: true, demo: true });
  }
  function emailSigned(rec, pdf64) {
    if (C.APPS_SCRIPT_URL) return post({ action: 'emailSigned', user: session.user, pass: session.pass, id: rec.id, email: rec.email, name: rec.name, pdf64: pdf64 });
    console.log('[demo] signed PDF email →', rec.email);
    return Promise.resolve({ ok: true, demo: true, simulated: true });
  }

  /* ---------- login view ---------- */
  $('loginBtn').addEventListener('click', function () {
    var u = $('admUser').value.trim(), p = $('admPass').value;
    if (!u || !p) { alert('एडमिन ID और पासवर्ड भरें।'); return; }
    login(u, p).then(function (res) {
      if (res && res.ok) {
        session = { user: u, pass: p };
        $('loginView').style.display = 'none';
        $('dashView').style.display = 'block';
        refresh();
      } else {
        alert((res && res.error) || 'लॉगिन असफल — डेमो मोड में admin / svcs@2026 आज़माएँ।');
      }
    }).catch(function () { alert('सर्वर से संपर्क नहीं हो पाया।'); });
  });
  $('logoutBtn').addEventListener('click', function () {
    session = null;
    $('dashView').style.display = 'none';
    $('loginView').style.display = 'block';
    $('admPass').value = '';
  });
  $('refreshBtn').addEventListener('click', refresh);

  /* ---------- dashboard ---------- */
  function refresh() {
    loadList().then(function (res) {
      var rows = (res && res.rows) || [];
      var t = rows.length, p = 0, a = 0, rj = 0;
      rows.forEach(function (r) {
        if (r.status === 'PENDING') p++;
        else if (r.status === 'APPROVED') a++;
        else if (r.status === 'REJECTED') rj++;
      });
      $('tTotal').textContent = t; $('tPending').textContent = p;
      $('tApproved').textContent = a; $('tRejected').textContent = rj;

      var tb = $('appRows'); tb.innerHTML = '';
      if (!rows.length) {
        tb.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--muted);padding:26px">अभी कोई आवेदन नहीं है।</td></tr>';
        return;
      }
      rows.forEach(function (r) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + (r.photo ? '<img class="photo-thumb" src="' + r.photo + '">' : '—') + '</td>' +
          '<td>' + esc(r.id) + '</td><td><strong>' + esc(r.name) + '</strong></td>' +
          '<td>' + esc(r.role) + '</td><td>' + esc(r.type) + '</td>' +
          '<td>' + esc(r.mobile) + '</td><td>' + esc(r.email) + '</td>' +
          '<td>' + esc(r.utr) + '</td><td>' + esc(r.ts) + '</td>' +
          '<td><span class="status-pill st-' + esc(r.status) + '">' + hiStatus(r.status) + '</span></td>' +
          '<td class="acts"></td>';
        var acts = tr.querySelector('.acts');
        if (r.status === 'PENDING') {
          acts.appendChild(btn('✅ स्वीकृत', 'mini-ok', function () {
            setStatus(r.id, 'APPROVED').then(refresh);
          }));
          acts.appendChild(btn('❌ अस्वीकृत', 'mini-bad', function () {
            var remark = prompt('अस्वीकृति का कारण:') || '';
            setStatus(r.id, 'REJECTED', remark).then(refresh);
          }));
        }
        if (r.status === 'APPROVED') {
          acts.appendChild(btn('✍️ हस्ताक्षरित PDF भेजें', 'mini-pdf', function () { sendSigned(r, this); }));
        }
        tb.appendChild(tr);
      });
    });
  }
  function btn(text, cls, fn) {
    var b = document.createElement('button');
    b.className = 'mini-btn ' + cls; b.textContent = text; b.style.marginRight = '6px';
    b.addEventListener('click', function () { fn.call(b); });
    return b;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function hiStatus(s) { return s === 'APPROVED' ? 'स्वीकृत' : s === 'REJECTED' ? 'अस्वीकृत' : 'लंबित'; }

  /* ---------- signed PDF ---------- */
  function sendSigned(rec, btnEl) {
    setF('name', rec.name); setF('role', rec.role); setF('type', rec.type);
    setF('memno', rec.memno || '-'); setF('mobile', rec.mobile);
    setF('join', rec.join ? rec.join.split('-').reverse().join('/') : '-');
    setF('regno', rec.regno || '-');
    setF('approved', new Date().toLocaleDateString('hi-IN'));
    var img = $('signPhoto');
    if (rec.photo) { img.src = rec.photo; img.style.display = 'block'; img.previousElementSibling.style.display = 'none'; }

    var old = btnEl.textContent; btnEl.textContent = '⏳ भेज रहे हैं...'; btnEl.disabled = true;
    var res = html2pdf().set({
      margin: 8,
      filename: 'SVCS-ID-APPROVED-' + rec.name + '.pdf',
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from($('signFront')).outputPdf('blob');
    Promise.resolve(res).then(function (r) {
      if (r instanceof Blob) return r;
      if (r && typeof r.output === 'function') return r.output('blob');
      throw new Error('PDF नहीं बना');
    }).then(function (blob) {
      var fr = new FileReader();
      fr.onload = function () {
        emailSigned(rec, fr.result.split(',')[1]).then(function (res) {
          alert(res && res.simulated
            ? 'डेमो मोड: PDF ईमेल सिमुलेटेड (SETUP.md से Apps Script जोड़ने पर असली ईमेल जाएगा)।'
            : '✅ हस्ताक्षरित ID Card PDF ' + rec.email + ' पर भेज दिया गया।');
          btnEl.textContent = old; btnEl.disabled = false;
        }).catch(function () {
          alert('ईमेल नहीं भेजा जा सका — दोबारा प्रयास करें।');
          btnEl.textContent = old; btnEl.disabled = false;
        });
      };
      fr.readAsDataURL(blob);
    });
  }
})();

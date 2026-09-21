/* SVCS — ID Card Generator: T&C gate, 3-step wizard, payment QR, PDF, secure submit */
(function () {
  var C = window.SVCS_CONFIG;
  var appId = null;
  var photoData = '';
  var lastPdfBlob = null;

  function $(id) { return document.getElementById(id); }
  function val(id) { return ($(id).value || '').trim(); }
  function setField(key, value) {
    document.querySelectorAll('[data-f="' + key + '"]').forEach(function (el) { el.textContent = value; });
  }
  function fmtDate(v) { if (!v) return '-'; var p = v.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

  /* ---------- Terms gate ---------- */
  var tcCheck = $('tcCheck'), tcAccept = $('tcAccept');
  if (tcCheck && tcAccept) {
    tcCheck.addEventListener('change', function () { tcAccept.disabled = !tcCheck.checked; });
    tcAccept.addEventListener('click', function () {
      window.SVCS.closeTerms();
    });
  } else if (window.SVCS) {
    window.SVCS.closeTerms();
  }

  /* ---------- Photo ---------- */
  $('photoInput').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        // resize ~360px max
        var max = 360, w = img.width, h = img.height;
        var s = Math.min(max / w, max / h, 1);
        var cv = document.createElement('canvas');
        cv.width = Math.round(w * s); cv.height = Math.round(h * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        photoData = cv.toDataURL('image/jpeg', 0.85);
        var thumb = $('photoThumb'), cardImg = $('cardPhoto');
        thumb.src = photoData; thumb.style.display = 'block';
        cardImg.src = photoData; cardImg.style.display = 'block';
        $('photoEmoji').style.display = 'none';
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  /* ---------- Live card render ---------- */
  var fieldIds = ['memberName','memberRole','memberType','memberNo','memberRegNo','memberMobile','memberBlood','memberJoin','memberEmail','memberAddr'];
  function renderCard() {
    setField('name', val('memberName') || 'Member Name');
    setField('role', val('memberRole') || 'पद');
    setField('memno', val('memberNo') || '-');
    setField('regno', val('memberRegNo') || '-');
    setField('mobile', val('memberMobile') || '-');
    setField('blood', val('memberBlood') || '-');
    setField('join', fmtDate(val('memberJoin')));
    setField('email', val('memberEmail') || '-');
    setField('addr', val('memberAddr') || '-');
    var type = val('memberType') || 'सदस्य';
    setField('type', type);
    document.querySelectorAll('.mem-badge').forEach(function (b) { b.classList.toggle('active', type === 'सक्रिय सदस्य'); });

    var box = $('qrcode'); box.innerHTML = '';
    new QRCode(box, {
      text: 'SVCS|' + (val('memberName') || '-') + '|' + (val('memberRole') || '-') + '|' + (val('memberNo') || '-') + '|' + type,
      width: 96, height: 96, colorDark: '#102a72', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H
    });
  }
  fieldIds.forEach(function (id) {
    var el = $(id);
    el.addEventListener('input', renderCard);
    el.addEventListener('change', renderCard);
  });
  renderCard();

  /* ---------- 3D flip + tilt ---------- */
  var cardFlip = $('cardFlip');
  cardFlip.addEventListener('click', function () { cardFlip.classList.toggle('flipped'); });
  cardFlip.addEventListener('mousemove', function (e) {
    if (cardFlip.classList.contains('flipped')) return;
    var r = cardFlip.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    cardFlip.style.transform = 'rotateY(' + (x * 10) + 'deg) rotateX(' + (-y * 10) + 'deg)';
  });
  cardFlip.addEventListener('mouseleave', function () { cardFlip.style.transform = ''; });

  /* ---------- Wizard ---------- */
  function goStep(n) {
    [1, 2, 3].forEach(function (i) {
      $('wp' + i).classList.toggle('active', i === n);
      var s = $('ws' + i);
      s.classList.toggle('active', i === n);
      s.classList.toggle('done', i < n);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $('toStep2').addEventListener('click', function () {
    if (!photoData) { alert('कृपया फोटो अपलोड करें।'); return; }
    if (!val('memberName')) { alert('कृपया पूरा नाम भरें (जैसे: Dinesh Singh)।'); return; }
    if (!val('memberRole')) { alert('कृपया पद चुनें।'); return; }
    if (!/^\d{10}$/.test(val('memberMobile'))) { alert('कृपया सही 10 अंकों का मोबाइल नंबर भरें।'); return; }
    if (!/^\S+@\S+\.\S+$/.test(val('memberEmail'))) { alert('कृपया सही ईमेल ID भरें — ID Card PDF इसी पर भेजा जाएगा।'); return; }

    var type = val('memberType') || 'सदस्य';
    var fee = (C.FEE && C.FEE[type]) || 501;
    $('payType').textContent = type;
    $('payAmount').textContent = '₹' + fee;
    $('payUpi').textContent = C.UPI_ID;
    var upiUri = 'upi://pay?pa=' + C.UPI_ID + '&pn=' + encodeURIComponent(C.PAYEE_NAME) + '&am=' + fee + '&cu=INR&tn=' + encodeURIComponent('SVCS Sadasyata - ' + val('memberName'));
    var pq = $('payQr'); pq.innerHTML = '';
    new QRCode(pq, { text: upiUri, width: 168, height: 168, colorDark: '#102a72', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
    goStep(2);
  });
  $('backTo1').addEventListener('click', function () { goStep(1); });
  $('backTo2').addEventListener('click', function () { goStep(3); });
  $('toStep3').addEventListener('click', function () {
    if (!val('payUtr')) { alert('कृपया भुगतान का UTR / संदर्भ नंबर भरें।'); return; }
    goStep(3);
  });

  /* ---------- PDF ---------- */
  function pdfOpts(name) {
    return {
      margin: 8, filename: name,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
  }
  function getPdfBlob(el, name) {
    var res = html2pdf().set(pdfOpts(name)).from(el).outputPdf('blob');
    return Promise.resolve(res).then(function (r) {
      if (r instanceof Blob) return r;
      if (r && typeof r.output === 'function') return r.output('blob');
      throw new Error('PDF नहीं बना');
    });
  }
  function buildPdf() { return getPdfBlob($('printArea'), 'SVCS-ID-' + (val('memberName') || 'card') + '.pdf'); }
  $('downloadPdf').addEventListener('click', function () {
    html2pdf().set(pdfOpts('SVCS-ID-' + (val('memberName') || 'card') + '.pdf')).from($('printArea')).save();
  });

  /* ---------- Submit (Apps Script ya demo) ---------- */
  function post(payload) {
    return fetch(C.APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) }).then(function (r) { return r.json(); });
  }
  function demoSave(rec) {
    var all = JSON.parse(localStorage.getItem('svcs_apps') || '[]');
    all.unshift(rec);
    localStorage.setItem('svcs_apps', JSON.stringify(all));
    return { ok: true, demo: true };
  }

  $('generateBtn').addEventListener('click', function () {
    renderCard();
    appId = 'SVCS/' + new Date().getFullYear() + '/' + Date.now().toString().slice(-6);
    var rec = {
      id: appId, ts: new Date().toLocaleString('hi-IN'),
      name: val('memberName'), role: val('memberRole'), type: val('memberType'),
      memno: val('memberNo'), regno: val('memberRegNo'), mobile: val('memberMobile'),
      blood: val('memberBlood'), join: val('memberJoin'), addr: val('memberAddr'),
      email: val('memberEmail'), utr: val('payUtr'), photo: photoData, status: 'PENDING', remark: ''
    };
    var btn = this; btn.disabled = true; btn.textContent = '⏳ बन रहा है...';

    buildPdf().then(function (blob) {
      lastPdfBlob = blob;
      var fr = new FileReader();
      fr.onload = function () {
        var pdf64 = fr.result.split(',')[1];
        var done = function () {
          $('genArea').style.display = 'none';
          $('successArea').style.display = 'block';
          $('appIdText').textContent = 'आवेदन संख्या: ' + appId;
          $('emailText').textContent = rec.email;
          btn.disabled = false; btn.textContent = '🪪 ID Card Generate करें';
        };
        if (C.APPS_SCRIPT_URL) {
          rec.action = 'submit';
          rec.pdf64 = pdf64;
          post(rec).then(done).catch(function () {
            alert('सर्वर से संपर्क नहीं हो पाया — कृपया दोबारा प्रयास करें।');
            btn.disabled = false; btn.textContent = '🪪 ID Card Generate करें';
          });
        } else {
          demoSave(rec); // demo mode: localStorage me secure rehkar admin portal me dikhega
          done();
        }
      };
      fr.readAsDataURL(blob);
    });
  });

  /* ---------- New application: saara data saaf (public pe kuch show nahi) ---------- */
  $('newApp').addEventListener('click', function () {
    if (!confirm('नया आवेदन करें? वर्तमान फॉर्म का डेटा साफ हो जाएगा।')) return;
    fieldIds.forEach(function (id) { $(id).value = ''; });
    photoData = ''; lastPdfBlob = null; appId = null;
    $('photoThumb').style.display = 'none';
    $('cardPhoto').style.display = 'none';
    $('photoEmoji').style.display = '';
    $('payUtr').value = '';
    $('genArea').style.display = 'block';
    $('successArea').style.display = 'none';
    cardFlip.classList.remove('flipped');
    renderCard();
    goStep(1);
  });
})();

/**
 * SVCS — सुरक्षित बैकएंड (Google Apps Script Web App)
 * SETUP.md के अनुसार सेटअप करें।
 *
 * स्टोरेज : Google Sheet  |  फोटो : Google Drive फोल्डर  |  ईमेल : Gmail
 * लॉगिन  : Script Properties में ADMIN_USER / ADMIN_PASS (कभी वेबसाइट कोड में नहीं)
 */
const SHEET_NAME = 'Applications';
const PHOTO_FOLDER = 'SVCS-ID-Photos';

function doGet() {
  return json({ ok: true, service: 'SVCS ID Card API', status: 'running' });
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const action = req.action;

    if (action === 'login') {
      return json(checkAdmin(req) ? { ok: true } : { ok: false, error: 'गलत ID या पासवर्ड' });
    }
    if (action === 'submit') return handleSubmit(req);
    if (action === 'list') return checkAdmin(req) ? json({ ok: true, rows: allRows() }) : deny();
    if (action === 'status') {
      if (!checkAdmin(req)) return deny();
      return json(updateStatus(req.id, req.status, req.remark));
    }
    if (action === 'emailSigned') {
      if (!checkAdmin(req)) return deny();
      return json(sendSignedPdf(req));
    }
    return json({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ---------- helpers ---------- */
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function deny() { return json({ ok: false, error: 'unauthorized' }); }
function checkAdmin(req) {
  const p = PropertiesService.getScriptProperties();
  return req && req.user === p.getProperty('ADMIN_USER') && req.pass === p.getProperty('ADMIN_PASS');
}
function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['ID','Timestamp','Name','Role','Type','MemberNo','RegNo','Mobile','Blood','Join','Address','Email','UTR','PhotoLink','Status','Remark']);
  }
  return sh;
}
function photoFolder() {
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
}

/* ---------- submit ---------- */
function handleSubmit(req) {
  let photoLink = '';
  if (req.photo) {
    const blob = Utilities.newBlob(Utilities.base64Decode(req.photo.split(',').pop()), 'image/jpeg', req.id + '.jpg');
    const file = photoFolder().createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    photoLink = file.getUrl();
  }
  sheet().appendRow([
    req.id, req.ts, req.name, req.role, req.type, req.memno, req.regno,
    req.mobile, req.blood, req.join, req.addr, req.email, req.utr, photoLink, 'PENDING', ''
  ]);

  // ग्राहक को तुरंत पावती + ID Card PDF (जो फ्रंटएंड से आया है)
  const p = PropertiesService.getScriptProperties();
  const subject = 'SVCS — ID Card आवेदन प्राप्त (आवेदन सं. ' + req.id + ')';
  const body =
    'नमस्ते ' + req.name + ',\n\n' +
    'सामाजिक विकास चेतना समिति में आपका सदस्य ID Card आवेदन प्राप्त हुआ है।\n\n' +
    'आवेदन संख्या: ' + req.id + '\n' +
    'सदस्यता प्रकार: ' + req.type + '\n' +
    'भुगतान UTR: ' + req.utr + '\n\n' +
    'आपका ID Card PDF संलग्न है। समिति की स्वीकृति के बाद हस्ताक्षरित ID Card PDF आपको ईमेल किया जाएगा।\n\n' +
    'धन्यवाद,\nसामाजिक विकास चेतना समिति (SVCS)\n+91 8349036076';
  const options = { name: 'SVCS — सामाजिक विकास चेतना समिति', attachments: [] };
  if (req.pdf64) {
    options.attachments = [Utilities.newBlob(Utilities.base64Decode(req.pdf64), 'application/pdf', 'SVCS-ID-' + req.name + '.pdf')];
  }
  MailApp.sendEmail(req.email, subject, body, options);
  if (p.getProperty('NOTIFY_EMAIL')) {
    MailApp.sendEmail(p.getProperty('NOTIFY_EMAIL'), 'SVCS: नया ID Card आवेदन — ' + req.name,
      'आवेदन सं.: ' + req.id + '\nनाम: ' + req.name + '\nपद: ' + req.role + '\nमोबाइल: ' + req.mobile + '\nUTR: ' + req.utr + '\n\nएडमिन पोर्टल में जाँच कर स्वीकृत करें।');
  }
  return json({ ok: true, id: req.id });
}

/* ---------- list / status ---------- */
function allRows() {
  const values = sheet().getDataRange().getValues();
  values.shift();
  return values.reverse().map(r => ({
    id: r[0], ts: r[1], name: r[2], role: r[3], type: r[4], memno: r[5], regno: r[6],
    mobile: r[7], blood: r[8], join: r[9], addr: r[10], email: r[11], utr: r[12],
    photo: r[13], status: r[14], remark: r[15]
  })).filter(r => r.id);
}
function updateStatus(id, status, remark) {
  const sh = sheet();
  const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) {
      sh.getRange(i + 1, 15).setValue(status);
      sh.getRange(i + 1, 16).setValue(remark || '');
      return { ok: true };
    }
  }
  return { ok: false, error: 'id not found' };
}
function sendSignedPdf(req) {
  const body =
    'नमस्ते ' + req.name + ',\n\n' +
    'आपका सदस्य ID Card समिति द्वारा स्वीकृत एवं हस्ताक्षरित कर दिया गया है।\n' +
    'हस्ताक्षरित ID Card PDF संलग्न है — कृपया सुरक्षित रखें।\n\n' +
    'धन्यवाद,\nसामाजिक विकास चेतना समिति (SVCS)\n+91 8349036076';
  const options = { name: 'SVCS — सामाजिक विकास चेतना समिति', attachments: [] };
  if (req.pdf64) {
    options.attachments = [Utilities.newBlob(Utilities.base64Decode(req.pdf64), 'application/pdf', 'SVCS-ID-APPROVED-' + req.name + '.pdf')];
  }
  MailApp.sendEmail(req.email, 'SVCS — आपका हस्ताक्षरित सदस्य ID Card (स्वीकृत)', body, options);
  return { ok: true };
}

(function () {
  var PHONE = "+254700015009", PHONE_SHOW = "+254 700 015 009", EMAIL = "info@lindamwanachischool.co.ke";
  var DEFAULT_ABOUT = "Linda Mwananchi School is a community school committed to giving every learner a strong start. We work closely with parents and guardians so that each child is known, supported and encouraged to do well.";
  var VALUES = [
    ["Respect", "Learners, parents and staff treat one another with care."],
    ["Integrity", "We are honest about progress, fees and expectations."],
    ["Excellence", "We expect each learner to work towards their best."],
    ["Community", "We grow together with the families we serve."]
  ];

  var S = { db: null, user: null, canEdit: false, uid: null, name: "",
    fees: null, about: null, students: [], inquiries: [],
    loaded: { fees: false, about: false, students: false, inq: false },
    timedOut: false, editFees: false, editAbout: false,
    staffTab: "fees", cls: "All", q: "", payFor: null, loginTab: "parent", parent: null, started: false };
  var SV = null;

  /* ---------- helpers ---------- */
  function h(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k === "value") e.value = v;
      else if (k.indexOf("on") === 0) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    });
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(e, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(e, x); }); return; }
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  function money(n) { return "KES " + Number(n || 0).toLocaleString("en-KE"); }
  function num(v) { var n = Math.round(Number(String(v).replace(/[^\d.]/g, ""))); return isFinite(n) ? n : 0; }
  function day(s) {
    var d = new Date(s + "T00:00:00");
    return isNaN(d) ? s : d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function admId(s) { return String(s || "").trim().toUpperCase().replace(/[^A-Z0-9_\-.~:@+]/g, "-").replace(/^\.+$/, "-").slice(0, 60); }
  function toast(msg, bad) {
    var box = document.getElementById("toastBox");
    var t = h("div", { class: "toast" + (bad ? " bad" : ""), role: "status", text: msg });
    box.innerHTML = ""; box.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 3800);
  }
  function copy(text, btn) {
    var done = function () { var o = btn.textContent; btn.textContent = "Copied"; setTimeout(function () { btn.textContent = o; }, 1400); };
    try { navigator.clipboard.writeText(text).then(done, function () { toast("Select the text and copy it", true); }); }
    catch (e) { toast("Select the text and copy it", true); }
  }
  function classes() { return S.fees && S.fees.rows ? S.fees.rows.map(function (r) { return r.cls; }) : []; }
  function feeFor(cls) { return S.fees && S.fees.rows ? S.fees.rows.filter(function (r) { return r.cls === cls; })[0] : null; }
  function paidOf(st) { return (st.payments || []).reduce(function (a, p) { return a + (p.amt || 0); }, 0); }
  function split(fee, paid) {
    var left = paid;
    return [fee.t1, fee.t2, fee.t3].map(function (t) {
      var p = Math.min(left, t); left -= p;
      return { due: t, paid: p, state: t > 0 && p >= t ? "paid" : p > 0 ? "part" : "none" };
    });
  }
  function statusOf(st) {
    var fee = feeFor(st.cls);
    var paid = paidOf(st);
    if (!fee) return { key: "nofee", label: "No fee set", paid: paid, due: 0, bal: 0, terms: null };
    var due = fee.t1 + fee.t2 + fee.t3;
    var key = due > 0 && paid >= due ? "paid" : paid > 0 ? "part" : "none";
    return { key: key, label: key === "paid" ? "Paid in full" : key === "part" ? "Part paid" : "Not paid", paid: paid, due: due, bal: Math.max(0, due - paid), terms: split(fee, paid) };
  }
  function loadNote(kind) {
    if (!S.db) return h("p", { class: "status-line", text: "The school records are not connected on this device yet. Please sign in to view them, or call the office." });
    if (S.loaded[kind]) return null;
    return h("p", { class: "status-line", text: S.timedOut ? "Still unable to reach the school records. Check your connection." : "Loading…" });
  }
  function pageHead(title, lead) {
    return h("div", { class: "page-head" }, h("h1", { text: title }), lead ? h("p", { text: lead }) : null);
  }
  function contactLinks() {
    return [
      h("a", { href: "tel:" + PHONE, text: PHONE_SHOW }),
      h("a", { href: "mailto:" + EMAIL, text: EMAIL })
    ];
  }

  /* ---------- views ---------- */
  function homeView() {
    var hero = h("section", { class: "hero" },
      h("div", null,
        h("span", { class: "label", text: "Welcome to" }),
        h("h1", { text: "Linda Mwananchi School" }),
        h("p", { text: "Parents and guardians can check school fee status online, read about the school and send an inquiry to the office." }),
        h("div", { class: "row" },
          h("a", { class: "btn gold", href: "#login", text: "Check school fees" }),
          h("a", { class: "btn ghost", href: "#inquiry", text: "Send an inquiry" }))),
      h("div", { class: "contact" },
        h("span", { class: "label", text: "Contact the school" }),
        contactLinks()[0], contactLinks()[1]));
    var tiles = h("section", { class: "grid" },
      h("a", { class: "card tile", href: "#about" }, h("h3", { text: "About the school" }), h("p", { text: "Who we are and what we stand for." }), h("span", { class: "go", text: "Read more →" })),
      h("a", { class: "card tile t2", href: "#fees" }, h("h3", { text: "School fees" }), h("p", { text: "Fees for each class, term by term." }), h("span", { class: "go", text: "See the fees →" })),
      h("a", { class: "card tile t3", href: "#login" }, h("h3", { text: "Check fee status" }), h("p", { text: "Confirm whether a learner has paid." }), h("span", { class: "go", text: "Sign in →" })));
    return [hero, tiles];
  }

  function aboutView() {
    var wrap = h("div", { class: "about-text" });
    var text = (S.about && S.about.text) || DEFAULT_ABOUT;
    if (S.editAbout) {
      var ta = h("textarea", { id: "aboutText", "aria-label": "About text" });
      ta.value = text;
      wrap.append(ta, h("div", { class: "row" },
        h("button", { class: "btn small", type: "button", text: "Save", onclick: function () {
          var v = ta.value.trim();
          if (!v) { toast("Write something first", true); return; }
          S.db.doc("settings/about").set({ text: v }).then(function () { S.editAbout = false; toast("About text saved"); render(); },
            function () { toast("Could not save. Check your access.", true); });
        } }),
        h("button", { class: "btn small ghost", type: "button", text: "Cancel", onclick: function () { S.editAbout = false; render(); } })));
    } else {
      text.split(/\n+/).forEach(function (p) { wrap.append(h("p", { text: p })); });
      if (S.canEdit && S.db) wrap.append(h("div", { class: "row" }, h("button", { class: "btn small ghost", type: "button", text: "Edit this text", onclick: function () { S.editAbout = true; render(); } })));
    }
    return [pageHead("About the school"), wrap,
      h("section", { class: "values", "aria-label": "Our values" }, VALUES.map(function (v) { return h("div", { class: "card" }, h("h3", { text: v[0] }), h("p", { text: v[1] })); })),
      h("p", { class: "note" }, "Questions about the school? Call ", h("a", { href: "tel:" + PHONE, text: PHONE_SHOW }), " or go to ", h("a", { href: "#contact", text: "Contact" }), ".")];
  }

  function feesView() {
    var out = [pageHead("School fees", "Fees are shown in Kenya shillings (KES) for each class. Fees are paid per term.")];
    var ln = loadNote("fees"); if (ln) out.push(ln);
    var f = S.fees;
    if (S.db && S.loaded.fees && !f) {
      out.push(h("p", { class: "note", text: "The fee structure has not been published yet. Please contact the school office." }));
      if (S.canEdit) out.push(h("button", { class: "btn", type: "button", text: "Create fee table", onclick: function () { S.fees = { rows: [{ cls: "Class 1", t1: 0, t2: 0, t3: 0 }], note: "", sample: false }; S.editFees = true; render(); } }));
      return out;
    }
    if (!f) return out;
    if (f.sample) out.push(h("div", { class: "banner" }, h("span", { text: "These amounts are sample figures. The school office will confirm the official fees." })));
    if (S.editFees) { out.push(feesEditor(f)); return out; }
    var body = h("tbody");
    f.rows.forEach(function (r) {
      body.append(h("tr", null, h("td", null, h("b", { text: r.cls })), h("td", { class: "num", text: money(r.t1) }), h("td", { class: "num", text: money(r.t2) }), h("td", { class: "num", text: money(r.t3) }), h("td", { class: "num" }, h("b", { text: money(r.t1 + r.t2 + r.t3) }))));
    });
    out.push(h("div", { class: "scroll" }, h("table", null,
      h("thead", null, h("tr", null, h("th", { text: "Class" }), h("th", { class: "num", text: "Term 1" }), h("th", { class: "num", text: "Term 2" }), h("th", { class: "num", text: "Term 3" }), h("th", { class: "num", text: "Year total" }))), body)));
    if (f.note) out.push(h("p", { class: "note", text: f.note }));
    out.push(h("div", { class: "row" },
      h("a", { class: "btn gold", href: "#login", text: "Check a learner's fees" }),
      h("a", { class: "btn ghost", href: "#inquiry", text: "Ask about fees" }),
      S.canEdit && S.db ? h("button", { class: "btn small ghost", type: "button", text: "Edit fees", onclick: function () { S.editFees = true; render(); } }) : null));
    return out;
  }

  function feesEditor(f) {
    var rows = JSON.parse(JSON.stringify(f.rows));
    var note = f.note || "";
    var body = h("tbody");
    function draw() {
      body.innerHTML = "";
      rows.forEach(function (r, i) {
        function inp(key) { return h("input", { type: "text", inputmode: "numeric", value: r[key], "aria-label": r.cls + " " + key, oninput: function (e) { r[key] = num(e.target.value); } }); }
        body.append(h("tr", null,
          h("td", null, h("input", { type: "text", value: r.cls, "aria-label": "Class name", oninput: function (e) { r.cls = e.target.value; } })),
          h("td", null, inp("t1")), h("td", null, inp("t2")), h("td", null, inp("t3")),
          h("td", null, h("button", { class: "btn small danger", type: "button", text: "Remove", onclick: function () { rows.splice(i, 1); draw(); } }))));
      });
    }
    draw();
    var noteIn = h("textarea", { id: "feeNote", "aria-label": "Payment note" }); noteIn.value = note;
    return h("div", { class: "card" },
      h("h3", { text: "Edit fees" }),
      h("p", { class: "status-line", text: "Amounts are per term, in KES. Learners are grouped by the class names you set here." }),
      h("div", { class: "scroll" }, h("table", null, h("thead", null, h("tr", null, h("th", { text: "Class" }), h("th", { text: "Term 1" }), h("th", { text: "Term 2" }), h("th", { text: "Term 3" }), h("th", { text: "" }))), body)),
      h("div", { class: "row" }, h("button", { class: "btn small ghost", type: "button", text: "Add class", onclick: function () { rows.push({ cls: "", t1: 0, t2: 0, t3: 0 }); draw(); } })),
      h("div", { class: "field" }, h("label", { for: "feeNote", text: "Payment note shown under the table" }), noteIn),
      h("div", { class: "row" },
        h("button", { class: "btn", type: "button", text: "Save fees", onclick: function () {
          var clean = rows.map(function (r) { return { cls: String(r.cls).trim(), t1: num(r.t1), t2: num(r.t2), t3: num(r.t3) }; }).filter(function (r) { return r.cls; });
          if (!clean.length) { toast("Add at least one class", true); return; }
          S.db.doc("settings/fees").set({ rows: clean, note: noteIn.value.trim(), sample: false, updated: new Date().toISOString() })
            .then(function () { S.editFees = false; toast("Fees saved"); render(); }, function () { toast("Could not save. Check your access.", true); });
        } }),
        h("button", { class: "btn ghost", type: "button", text: "Cancel", onclick: function () { S.editFees = false; render(); } })));
  }

  function loginView() {
    var out = [pageHead("Check fees", "Parents and guardians can confirm a learner's fee status. School staff sign in to manage fees for every class.")];
    var tabs = h("div", { class: "tabs", role: "group", "aria-label": "Who is signing in" },
      h("button", { type: "button", "aria-pressed": String(S.loginTab === "parent"), text: "Parent / Guardian", onclick: function () { S.loginTab = "parent"; render(); } }),
      h("button", { type: "button", "aria-pressed": String(S.loginTab === "staff"), text: "School staff", onclick: function () { S.loginTab = "staff"; render(); } }));
    out.push(tabs);
    if (S.loginTab === "staff") {
      var c = h("div", { class: "card login-box" });
      if (S.canEdit && S.db) {
        c.append(h("h3", { text: "You are signed in as staff" }), h("p", { text: "You can record payments, add learners and read inquiries." }),
          h("div", { class: "row" }, h("a", { class: "btn gold", href: "#staff", text: "Open staff dashboard" })));
      } else {
        c.append(h("h3", { text: "Staff access" }),
          h("p", { text: "Staff sign in with their Claude account, and the page owner gives them Editor access to this page. If you are staff and cannot open the dashboard, ask the owner to share the page with you as an Editor." }));
      }
      out.push(c); return out;
    }
    var result = h("div", { "aria-live": "polite" });
    var adm = h("input", { id: "adm", type: "text", autocomplete: "off", placeholder: "e.g. LM-1001", required: true });
    var ph = h("input", { id: "ph4", type: "text", inputmode: "numeric", maxlength: "4", autocomplete: "off", placeholder: "1234", required: true });
    var btn = h("button", { class: "btn", type: "submit", text: "Check fee status" });
    var form = h("form", { class: "card login-box", onsubmit: function (e) {
      e.preventDefault();
      var id = admId(adm.value), last4 = ph.value.replace(/\D/g, "");
      if (!id || last4.length !== 4) { result.replaceChildren(h("p", { class: "err", text: "Enter the admission number and the last 4 digits of the guardian's phone." })); return; }
      if (!S.db) { result.replaceChildren(h("p", { class: "err", text: "Fee checks are not available on this device right now. Please call the school office." })); return; }
      btn.disabled = true; btn.textContent = "Checking…";
      S.db.doc("students/" + id).get().then(function (snap) {
        btn.disabled = false; btn.textContent = "Check fee status";
        var d = snap.exists ? snap.data() : null;
        var digits = d ? String(d.phone || "").replace(/\D/g, "") : "";
        if (!d || digits.slice(-4) !== last4) { result.replaceChildren(h("p", { class: "err", text: "We could not find a match. Check the admission number and phone digits, or contact the school office." })); return; }
        var st = JSON.parse(JSON.stringify(d)); st.id = id;
        result.replaceChildren(resultCard(st));
      }, function () { btn.disabled = false; btn.textContent = "Check fee status"; result.replaceChildren(h("p", { class: "err", text: "Something went wrong. Please try again." })); });
    } },
      h("h3", { text: "Parent / Guardian" }),
      h("div", { class: "field" }, h("label", { for: "adm", text: "Admission number" }), adm),
      h("div", { class: "field" }, h("label", { for: "ph4", text: "Last 4 digits of the guardian's phone number" }), ph, h("small", { text: "This is the number the school has on record." })),
      btn);
    out.push(form, result);
    if (S.db && S.sampleExists) out.push(h("p", { class: "note", text: "Sample record to try: admission number LM-S001 with phone digits 0001." }));
    return out;
  }

  function resultCard(st) {
    var s = statusOf(st);
    var left = h("div", { class: "rpanel " + s.key },
      h("span", { class: "label", text: "Fee status" }), h("div", { class: "big", text: s.label }),
      h("hr"), h("span", { class: "label", text: "Balance" }), h("div", { class: "big", text: money(s.bal) }),
      h("span", { class: "label", text: "Paid " + money(s.paid) + " of " + money(s.due) }));
    var right = h("div", { class: "card" },
      h("dl", { class: "kv" }, h("dt", { text: "Learner" }), h("dd", { text: st.name }), h("dt", { text: "Class" }), h("dd", { text: st.cls }), h("dt", { text: "Admission no." }), h("dd", { text: st.adm || st.id })));
    if (s.terms) right.append(h("h4", { text: "By term" }), h("div", { class: "terms" }, s.terms.map(function (t, i) {
      return h("div", { class: "term " + t.state }, h("span", { class: "label", text: "Term " + (i + 1) }), h("b", { text: money(t.paid) }), h("span", { text: "of " + money(t.due) }));
    })));
    var pays = (st.payments || []).slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    right.append(h("h4", { text: "Payments received" }));
    right.append(pays.length ? h("ul", { class: "pay-list" }, pays.map(function (p) { return h("li", null, h("span", { text: day(p.at) + (p.ref ? " · " + p.ref : "") }), h("b", { text: money(p.amt) })); })) : h("p", { class: "status-line", text: "No payments recorded yet." }));
    return h("div", { class: "result" }, left, right);
  }

  /* ---------- staff ---------- */
  function staffView() {
    if (!S.canEdit || !S.db) {
      return [pageHead("Staff dashboard"), h("div", { class: "card login-box" }, h("h3", { text: "Staff only" }), h("p", { text: "This area is for school staff with Editor access to this page." }), h("div", { class: "row" }, h("a", { class: "btn", href: "#login", text: "Back to sign in" })))];
    }
    SV = {};
    var head = pageHead("Staff dashboard");
    var tabs = h("div", { class: "tabs", role: "group", "aria-label": "Dashboard sections" },
      h("button", { type: "button", "aria-pressed": String(S.staffTab === "fees"), text: "Fees by class", onclick: function () { S.staffTab = "fees"; render(); } }),
      SV.inqBtn = h("button", { type: "button", "aria-pressed": String(S.staffTab === "inq"), onclick: function () { S.staffTab = "inq"; render(); } }));
    var body = h("div", { style: "display:grid;gap:20px" });
    SV.body = body;
    if (S.staffTab === "fees") buildFees(body); else buildInq(body);
    updateStaff();
    return [head, tabs, body];
  }

  function buildFees(body) {
    SV.banner = h("div");
    SV.chips = h("div", { class: "chips", role: "group", "aria-label": "Filter by class" });
    SV.sum = h("div", { class: "sum" });
    var search = h("input", { id: "search", type: "search", placeholder: "Search name or admission number", "aria-label": "Search learners", value: S.q, oninput: function (e) { S.q = e.target.value; updateList(); } });
    SV.pay = h("div");
    SV.list = h("div", { class: "scroll" });
    body.append(SV.banner, SV.chips, SV.sum, h("div", { class: "row" }, h("div", { style: "flex:1 1 240px" }, search)), addForm(), SV.pay, SV.list);
  }

  function addForm() {
    var d = h("details", { class: "add" }, h("summary", { text: "Add a learner" }));
    var adm = h("input", { id: "nAdm", type: "text", required: true, placeholder: "LM-1001" });
    var name = h("input", { id: "nName", type: "text", required: true });
    var cls = h("select", { id: "nCls" });
    SV.clsSelect = cls;
    var guard = h("input", { id: "nG", type: "text", placeholder: "Parent or guardian" });
    var phone = h("input", { id: "nPh", type: "tel", required: true, placeholder: "07XX XXX XXX" });
    d.append(h("form", { onsubmit: function (e) {
      e.preventDefault();
      var id = admId(adm.value);
      if (!id || !name.value.trim() || !cls.value || phone.value.replace(/\D/g, "").length < 4) { toast("Fill in admission number, name, class and phone", true); return; }
      var ref = S.db.doc("students/" + id);
      ref.get().then(function (snap) {
        if (snap.exists) { toast("That admission number already exists", true); return; }
        return ref.set({ adm: adm.value.trim().toUpperCase(), name: name.value.trim(), cls: cls.value, guardian: guard.value.trim(), phone: phone.value.trim(), payments: [] })
          .then(function () { toast("Learner added"); adm.value = name.value = guard.value = phone.value = ""; });
      }).catch(function () { toast("Could not save. Check your access.", true); });
    } },
      h("div", { class: "fields" },
        h("div", { class: "field" }, h("label", { for: "nAdm", text: "Admission number" }), adm),
        h("div", { class: "field" }, h("label", { for: "nName", text: "Learner's full name" }), name),
        h("div", { class: "field" }, h("label", { for: "nCls", text: "Class" }), cls),
        h("div", { class: "field" }, h("label", { for: "nG", text: "Guardian name" }), guard),
        h("div", { class: "field" }, h("label", { for: "nPh", text: "Guardian phone" }), phone)),
      h("div", { class: "row" }, h("button", { class: "btn", type: "submit", text: "Save learner" }))));
    return d;
  }

  function updateStaff() {
    if (!SV || !SV.body || !SV.body.isConnected) return;
    if (SV.inqBtn) SV.inqBtn.textContent = "Inquiries" + (openInq() ? " (" + openInq() + ")" : "");
    if (S.staffTab === "inq") { buildInqList(); return; }
    if (!SV.list) return;
    var cl = classes();
    if (S.cls !== "All" && cl.indexOf(S.cls) < 0) S.cls = "All";
    SV.chips.replaceChildren.apply(SV.chips, ["All"].concat(cl).map(function (c) {
      return h("button", { type: "button", "aria-pressed": String(S.cls === c), text: c, onclick: function () { S.cls = c; updateStaff(); } });
    }));
    if (SV.clsSelect) {
      var cur = SV.clsSelect.value;
      SV.clsSelect.replaceChildren.apply(SV.clsSelect, cl.map(function (c) { return h("option", { value: c, text: c }); }));
      if (cur && cl.indexOf(cur) >= 0) SV.clsSelect.value = cur;
    }
    SV.banner.replaceChildren();
    var samples = S.students.filter(function (s) { return s.sample; });
    if (samples.length) {
      SV.banner.append(h("div", { class: "banner" }, h("span", { text: "Sample learners are showing. Remove them before you add real records." }),
        h("button", { class: "btn small", type: "button", text: "Remove sample learners", onclick: removeSamples })));
    }
    if (!cl.length) SV.banner.append(h("p", { class: "note" }, "Set up the fee table first so learners can be placed in classes. ", h("a", { href: "#fees", text: "Go to School fees" })));
    updateList();
  }

  function visible() {
    var q = S.q.trim().toLowerCase();
    return S.students.filter(function (s) {
      if (S.cls !== "All" && s.cls !== S.cls) return false;
      if (!q) return true;
      return (s.name || "").toLowerCase().indexOf(q) >= 0 || (s.adm || s.id || "").toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });
  }

  function updateList() {
    if (!SV || !SV.list || !SV.list.isConnected) return;
    var ln = loadNote("students");
    var list = visible();
    var c = { paid: 0, part: 0, none: 0 }, got = 0, exp = 0;
    list.forEach(function (st) { var s = statusOf(st); if (c[s.key] != null) c[s.key]++; got += s.paid; exp += s.due; });
    var pct = exp ? Math.min(100, Math.round(got / exp * 100)) : 0;
    SV.sum.replaceChildren(
      stat("all", "Learners", list.length), stat("paid", "Paid in full", c.paid), stat("part", "Part paid", c.part), stat("none", "Not paid", c.none),
      h("div", { class: "stat all" }, h("span", { class: "label", text: "Collected" }), h("b", { text: money(got) }), h("div", { class: "bar-track", role: "img", "aria-label": pct + " percent of expected fees collected" }, h("div", { class: "bar-fill", style: "width:" + pct + "%" })), h("span", { class: "status-line", text: pct + "% of " + money(exp) })));
    if (SV.pay) { SV.pay.replaceChildren(); var cur = S.payFor && S.students.filter(function (x) { return x.id === S.payFor; })[0]; if (cur) SV.pay.append(payPanel(cur)); else S.payFor = null; }
    if (ln && !list.length) { SV.list.replaceChildren(ln); return; }
    if (!list.length) { SV.list.replaceChildren(h("p", { class: "status-line", style: "padding:16px", text: S.students.length ? "No learners match this class or search." : "No learners yet. Use “Add a learner” above." })); return; }
    var tb = h("tbody");
    list.forEach(function (st) {
      var s = statusOf(st);
      tb.append(h("tr", null,
        h("td", { text: st.adm || st.id }), h("td", null, h("b", { text: st.name }), st.sample ? h("span", { class: "badge nofee", style: "margin-left:6px", text: "sample" }) : null),
        h("td", { text: st.cls }), h("td", { class: "num", text: money(s.paid) }), h("td", { class: "num", text: money(s.bal) }),
        h("td", null, h("span", { class: "badge " + s.key, text: s.label })),
        h("td", null, h("div", { class: "actions" },
          h("button", { class: "btn small", type: "button", text: "Payments", onclick: function () { S.payFor = st.id; updateList(); if (SV.pay) SV.pay.scrollIntoView({ block: "nearest" }); } }),
          delBtn(st)))));
    });
    SV.list.replaceChildren(h("table", null, h("thead", null, h("tr", null, ["Adm. no.", "Learner", "Class"].map(function (t) { return h("th", { text: t }); }), h("th", { class: "num", text: "Paid" }), h("th", { class: "num", text: "Balance" }), h("th", { text: "Status" }), h("th", { text: "" }))), tb));
  }
  function stat(k, label, v) { return h("div", { class: "stat " + k }, h("span", { class: "label", text: label }), h("b", { text: v })); }

  function delBtn(st) {
    var armed = false, t;
    var b = h("button", { class: "btn small danger", type: "button", text: "Delete", onclick: function () {
      if (!armed) { armed = true; b.textContent = "Confirm?"; t = setTimeout(function () { armed = false; b.textContent = "Delete"; }, 4000); return; }
      clearTimeout(t);
      S.db.doc("students/" + st.id).delete().then(function () { toast("Learner deleted"); if (S.payFor === st.id) S.payFor = null; }, function () { toast("Could not delete", true); });
    } });
    return b;
  }

  function payPanel(st) {
    var s = statusOf(st);
    var amt = h("input", { id: "pAmt", type: "text", inputmode: "numeric", placeholder: "e.g. 5000" });
    var date = h("input", { id: "pDate", type: "date", value: today() });
    var ref = h("input", { id: "pRef", type: "text", placeholder: "Receipt or M-Pesa code (optional)" });
    var pays = (st.payments || []).slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    function save(next) { return S.db.doc("students/" + st.id).update({ payments: next }); }
    return h("div", { class: "card" },
      h("div", { class: "row", style: "justify-content:space-between" }, h("h3", { text: st.name + " · " + st.cls }), h("button", { class: "btn small ghost", type: "button", text: "Close", onclick: function () { S.payFor = null; updateList(); } })),
      h("p", { class: "status-line", text: s.terms ? "Paid " + money(s.paid) + " of " + money(s.due) + ". Balance " + money(s.bal) + "." : "Set a fee for this class first (School fees page)." }),
      h("form", { onsubmit: function (e) {
        e.preventDefault();
        var a = num(amt.value);
        if (a <= 0) { toast("Enter the amount received", true); return; }
        var next = (st.payments || []).concat([{ id: Date.now().toString(36), at: date.value || today(), amt: a, ref: ref.value.trim() }]);
        save(next).then(function () { toast("Payment recorded"); }, function () { toast("Could not save. Check your access.", true); });
      } },
        h("div", { class: "fields" },
          h("div", { class: "field" }, h("label", { for: "pAmt", text: "Amount received (KES)" }), amt),
          h("div", { class: "field" }, h("label", { for: "pDate", text: "Date" }), date),
          h("div", { class: "field" }, h("label", { for: "pRef", text: "Reference" }), ref)),
        h("div", { class: "row" }, h("button", { class: "btn gold", type: "submit", text: "Record payment" }))),
      pays.length ? h("ul", { class: "pay-list" }, pays.map(function (p) {
        return h("li", null, h("span", { text: day(p.at) + (p.ref ? " · " + p.ref : "") }), h("span", { class: "row" }, h("b", { text: money(p.amt) }),
          h("button", { class: "btn small danger", type: "button", text: "Remove", onclick: function () { save((st.payments || []).filter(function (x) { return x.id !== p.id; })).then(function () { toast("Payment removed"); }, function () { toast("Could not remove", true); }); } })));
      })) : null);
  }

  function removeSamples() {
    var ids = S.students.filter(function (s) { return s.sample; }).map(function (s) { return s.id; });
    Promise.all(ids.map(function (id) { return S.db.doc("students/" + id).delete(); })).then(function () { toast("Sample learners removed"); }, function () { toast("Could not remove all samples", true); });
  }

  /* ---------- inquiries ---------- */
  function allInq() {
    var out = [];
    S.inquiries.forEach(function (d) { (d.items || []).forEach(function (it) { out.push({ doc: d.id, it: it, all: d.items }); }); });
    return out.sort(function (a, b) { return a.it.at < b.it.at ? 1 : -1; });
  }
  function openInq() { return allInq().filter(function (x) { return !x.it.done; }).length; }
  function buildInq(body) { SV.inq = h("div", { style: "display:grid;gap:12px" }); body.append(SV.inq); }
  function buildInqList() {
    if (!SV || !SV.inq || !SV.inq.isConnected) return;
    var list = allInq(), ln = loadNote("inq");
    if (!list.length) { SV.inq.replaceChildren(ln || h("p", { class: "status-line", text: "No inquiries yet." })); return; }
    SV.inq.replaceChildren.apply(SV.inq, list.map(function (x) {
      var it = x.it;
      function write(items) { return S.db.doc("inquiries/" + x.doc).set({ items: items }); }
      return h("div", { class: "card inq" + (it.done ? " done" : "") },
        h("div", { class: "row", style: "justify-content:space-between" }, h("b", { text: it.topic }), it.done ? h("span", { class: "badge paid", text: "Done" }) : h("span", { class: "badge part", text: "Open" })),
        h("p", { text: it.msg }),
        h("div", { class: "meta" }, h("span", { text: it.name }), it.phone ? h("a", { href: "tel:" + it.phone.replace(/\s/g, ""), text: it.phone }) : null, h("span", { text: new Date(it.at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) })),
        h("div", { class: "row" },
          h("button", { class: "btn small", type: "button", text: it.done ? "Reopen" : "Mark done", onclick: function () { write(x.all.map(function (y) { return y.id === it.id ? Object.assign({}, y, { done: !y.done }) : y; })).catch(function () { toast("Could not update", true); }); } }),
          h("button", { class: "btn small danger", type: "button", text: "Delete", onclick: function () { write(x.all.filter(function (y) { return y.id !== it.id; })).catch(function () { toast("Could not delete", true); }); } })));
    }));
  }

  function inquiryView() {
    var out = [pageHead("Send an inquiry", "Ask the school office about fees, admissions or anything else. We reply by phone or email.")];
    var name = h("input", { id: "iName", type: "text", required: true, autocomplete: "name" });
    var phone = h("input", { id: "iPh", type: "tel", required: true, autocomplete: "tel", placeholder: "07XX XXX XXX" });
    var topic = h("select", { id: "iTopic" }, ["School fees", "Admissions", "Learner progress", "Other"].map(function (t) { return h("option", { value: t, text: t }); }));
    var msg = h("textarea", { id: "iMsg", required: true, placeholder: "Write your question here" });
    var status = h("div", { "aria-live": "polite" });
    var send = h("button", { class: "btn gold", type: "submit", text: "Send inquiry" });
    var form = h("form", { class: "card", onsubmit: function (e) {
      e.preventDefault();
      if (name.value.trim().length < 2 || phone.value.replace(/\D/g, "").length < 7 || msg.value.trim().length < 10) { status.replaceChildren(h("p", { class: "err", text: "Please add your name, a phone number and a message of at least 10 characters." })); return; }
      if (!S.db || !S.uid) { status.replaceChildren(h("p", { class: "err" }, "Sending from this page needs you to be signed in. Please call " + PHONE_SHOW + " or email " + EMAIL + ".")); return; }
      send.disabled = true; send.textContent = "Sending…";
      var ref = S.db.doc("inquiries/" + S.uid);
      ref.get().then(function (snap) {
        var items = snap.exists ? (snap.data().items || []).slice() : [];
        items.push({ id: Date.now().toString(36), at: new Date().toISOString(), name: name.value.trim(), phone: phone.value.trim(), topic: topic.value, msg: msg.value.trim(), done: false });
        return ref.set({ items: items.slice(-30) });
      }).then(function () {
        send.disabled = false; send.textContent = "Send inquiry"; msg.value = "";
        status.replaceChildren(h("div", { class: "banner" }, h("span", { text: "Thank you. Your inquiry has been sent to the school office." })));
      }, function () {
        send.disabled = false; send.textContent = "Send inquiry";
        status.replaceChildren(h("p", { class: "err" }, "Your access does not allow sending from this page. Please call " + PHONE_SHOW + " or email " + EMAIL + "."));
      });
    } },
      h("div", { class: "fields" },
        h("div", { class: "field" }, h("label", { for: "iName", text: "Your name" }), name),
        h("div", { class: "field" }, h("label", { for: "iPh", text: "Phone number" }), phone),
        h("div", { class: "field" }, h("label", { for: "iTopic", text: "Topic" }), topic)),
      h("div", { class: "field" }, h("label", { for: "iMsg", text: "Message" }), msg),
      h("div", { class: "row" }, send), status);
    out.push(h("div", { style: "display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));align-items:start" }, form,
      h("div", { class: "card" }, h("h3", { text: "Prefer to talk?" }), h("p", { text: "Call or email the office directly." }), h("a", { class: "big-link", href: "tel:" + PHONE, text: PHONE_SHOW }), h("a", { class: "big-link", href: "mailto:" + EMAIL, text: EMAIL }))));
    return out;
  }

  function contactView() {
    function box(label, value, href, display) {
      var cb = h("button", { class: "btn small ghost", type: "button", text: "Copy", onclick: function () { copy(value, cb); } });
      return h("div", { class: "card" }, h("span", { class: "label", text: label }), h("a", { class: "big-link", href: href, text: display || value }), h("div", { class: "row" }, cb));
    }
    return [pageHead("Contact the school", "The school office can help with fees, admissions and general questions."),
      h("div", { class: "contact-grid" }, box("Phone", PHONE, "tel:" + PHONE, PHONE_SHOW), box("Email", EMAIL, "mailto:" + EMAIL)),
      h("div", { class: "row" }, h("a", { class: "btn gold", href: "#inquiry", text: "Send an inquiry" }), h("a", { class: "btn ghost", href: "#login", text: "Check school fees" }))];
  }

  /* ---------- shell ---------- */
  var VIEWS = { home: homeView, about: aboutView, fees: feesView, login: loginView, staff: staffView, inquiry: inquiryView, contact: contactView };
  function current() { var v = (location.hash || "").replace("#", ""); return VIEWS[v] ? v : "home"; }
  function render() {
    var v = current();
    var app = document.getElementById("app");
    SV = null;
    app.replaceChildren.apply(app, [].concat(VIEWS[v]()));
    if (v === "staff") updateStaff();
    document.querySelectorAll("#nav a").forEach(function (a) {
      if (a.getAttribute("data-v") === (v === "staff" ? "login" : v)) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }
  function busy() { var a = document.activeElement; return a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && document.getElementById("app").contains(a); }
  var pending = false;
  function refresh() {
    renderWho();
    var v = current();
    if (v === "staff") { updateStaff(); return; }
    if (S.editFees || S.editAbout || v === "inquiry" || v === "login" || v === "contact") return;
    if (busy()) { pending = true; return; }
    render();
  }
  document.addEventListener("focusout", function () { if (pending) setTimeout(function () { if (!busy()) { pending = false; refresh(); } }, 50); });
  function renderWho() {
    var w = document.getElementById("who");
    var kids = [h("span", { class: "pill" + (S.canEdit ? " staff" : ""), text: S.canEdit ? "Staff" : "Visitor" })];
    if (S.name) kids.push(h("span", { text: S.name }));
    w.replaceChildren.apply(w, kids);
  }
  window.addEventListener("hashchange", function () { S.editFees = false; S.editAbout = false; S.payFor = null; render(); window.scrollTo(0, 0); });

  /* ---------- data ---------- */
  function start() {
    if (S.started) return; S.started = true;
    var db = S.db;
    var timer = setTimeout(function () { S.timedOut = true; refresh(); }, 10000);
    function done(k) { S.loaded[k] = true; if (S.loaded.fees && S.loaded.about) clearTimeout(timer); }
    function onErr(k) { return function () { S.loaded[k] = false; S.timedOut = true; refresh(); }; }
    db.doc("settings/fees").onSnapshot(function (s) { S.fees = s.exists ? JSON.parse(JSON.stringify(s.data())) : null; done("fees"); refresh(); }, onErr("fees"));
    db.doc("settings/about").onSnapshot(function (s) { S.about = s.exists ? JSON.parse(JSON.stringify(s.data())) : null; done("about"); refresh(); }, onErr("about"));
    if (S.canEdit) {
      db.collection("students").onSnapshot(function (s) {
        S.students = s.docs.map(function (d) { var x = JSON.parse(JSON.stringify(d.data())); x.id = d.id; return x; });
        S.sampleExists = S.students.some(function (x) { return x.sample; });
        done("students"); refresh();
      }, onErr("students"));
      db.collection("inquiries").onSnapshot(function (s) {
        S.inquiries = s.docs.map(function (d) { return { id: d.id, items: JSON.parse(JSON.stringify(d.data().items || [])) }; });
        done("inq"); refresh();
      }, onErr("inq"));
    } else {
      /* Public hint only: tells visitors a demo record exists. Reads one known document, not the list. */
      db.doc("students/LM-S001").get().then(function (s) { S.sampleExists = s.exists && !!s.data().sample; if (current() === "login") render(); }, function () {});
    }
  }
  async function boot() {
    renderWho(); render();
    try {
      var c = window.claude;
      if (!c || !c.use) return;
      S.user = await c.use("user");
      S.db = await c.use("db");
      if (S.user) {
        var me = await S.user.me();
        S.uid = me.id; S.name = me.name || "";
        S.canEdit = !!me.canEdit;
      }
      if (S.db) start();
      renderWho(); render();
    } catch (e) { /* page still works without live data */ }
  }
  boot();
})();

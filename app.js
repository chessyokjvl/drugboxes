/* =====================================================================
   JVL Drug Boxes — หน้าเว็บ (GitHub Pages) เชื่อมกับ api.php
   ===================================================================== */
'use strict';

const API_URL = (window.JVL_CONFIG && window.JVL_CONFIG.API_URL) || 'api.php';
const TOKEN_KEY = 'jvlDrugBoxes.token';
const LOGO = 'https://www.rploei.go.th/ec2/wp-content/uploads/2017/08/cropped-cropped-cropped-3.png';
const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const STORAGES = ['ในกล่อง (In Box)', 'ชั้นเก็บยา (On Shelf)', 'ตู้เย็น (Refrigerator)'];
const ST_LABEL = { expired: 'หมดอายุแล้ว', exp3m: 'หมดอายุ < 3 เดือน', exp6m: 'หมดอายุ 3-6 เดือน', ok: 'ปกติ', none: 'ไม่ระบุวันหมดอายุ' };
const ST_COLOR = { expired: '#2c3e50', exp3m: '#D64535', exp6m: '#E08A0B', ok: '#3D9962', none: '#8A968F' };
const ACT_COLOR = { INSERT: '#3D9962', UPDATE: '#E08A0B', DELETE: '#D64535', VERIFY: '#27ae60', OPEN_PKG: '#8e44ad', STATUS: '#3498db', STOCK_TAKE: '#1F5D3F' };
const ACT_LABEL = { INSERT: 'เพิ่ม', UPDATE: 'แก้ไข', DELETE: 'ลบ', VERIFY: 'ตรวจสอบ', OPEN_PKG: 'แกะซอง', STATUS: 'สถานะ', STOCK_TAKE: 'Stock Take', USER: 'ผู้ใช้', DRUG: 'ทะเบียนยา', BOX: 'กล่อง' };

const S = { me: null, settings: {}, departments: [], boxTypes: [], boxes: [], items: [], drugs: [], recentLogs: [], loaded: false };
const UI = { sort: {}, listFilter: {}, calMonth: null, calYear: null, charts: [], logRange: null, ts: [] };

/* ---------------------------------------------------------------------
   ตัวช่วยทั่วไป
   --------------------------------------------------------------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = (arr, id) => arr.find(x => x.id === Number(id));
const norm = s => String(s || '').toLowerCase().replace(/[\s\-./]/g, '');
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function parseYmd(s) {
    if (!s) return null;
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    return y ? new Date(y, m - 1, d) : null;
}
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function thDate(s, short = false) {
    const d = parseYmd(s); if (!d) return '-';
    const y = d.getFullYear() + 543;
    return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${short ? String(y).slice(2) : y}`;
}
function thDateTime(s) {
    if (!s) return '-';
    const [dp, tp = ''] = String(s).split(' ');
    return `${thDate(dp, true)} ${tp.slice(0, 5)}`;
}
/* รูปแบบวันที่บนป้ายกล่อง/สติ๊กเกอร์ (คงตามระบบเดิม: 05-มี.ค.-2027) */
function formatThaiShortDate(dateStr) {
    if (!dateStr || dateStr.toString().trim() === '') return '-';
    const d = dateStr instanceof Date ? dateStr : parseYmd(dateStr);
    if (!d || isNaN(d)) return '-';
    const day = d.getDate().toString().padStart(2, '0');
    const month = THAI_MONTHS_SHORT[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}
function daysText(n) {
    if (n === null || n === undefined) return '';
    if (n < 0) return `เกิน ${-n} วัน`;
    if (n === 0) return 'วันนี้';
    if (n < 60) return `อีก ${n} วัน`;
    return `อีก ${Math.round(n / 30)} เดือน`;
}
function expChip(it) {
    if (!it.expireDate) return `<span class="exp none">ไม่ระบุ</span>`;
    return `<span class="exp ${it.expStatus}" title="${esc(ST_LABEL[it.expStatus])}">${thDate(it.expireDate)}</span>`;
}
function deptBadge(deptId) {
    const d = byId(S.departments, deptId);
    return d ? `<span class="dept" style="background:${esc(d.color)}">${esc(d.short)}</span>` : '';
}
/* แปลง HTML คู่มือยาให้ปลอดภัย (อนุญาตเฉพาะแท็กจัดรูปแบบ) */
function safeHtml(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    const ok = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'BR', 'SMALL', 'UL', 'OL', 'LI', 'P']);
    (function walk(node) {
        [...node.children].forEach(el => {
            if (!ok.has(el.tagName)) { el.replaceWith(...el.childNodes); return walk(node); }
            [...el.attributes].forEach(a => { if (!(a.name === 'style' && el.tagName === 'SPAN' && !/url|expression/i.test(a.value))) el.removeAttribute(a.name); });
            walk(el);
        });
    })(doc.body.firstChild);
    return doc.body.firstChild.innerHTML;
}

/* ---------------------------------------------------------------------
   API
   --------------------------------------------------------------------- */
let inflight = 0;
function progress(on) {
    const p = $('#progress');
    if (on) { inflight++; p.className = 'on'; }
    else if (--inflight <= 0) { inflight = 0; p.className = 'done'; }
}
async function api(action, data = {}, opts = {}) {
    progress(true);
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(localStorage.getItem(TOKEN_KEY) ? { 'X-Auth-Token': localStorage.getItem(TOKEN_KEY) } : {}) },
            body: JSON.stringify({ action, ...data }),
        });
        let json;
        try { json = await res.json(); } catch { throw new Error('เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (HTTP ' + res.status + ')'); }
        if (res.status === 401 && S.me) { forceLogout(json.message); throw new Error(json.message); }
        if (json.status !== 'success') throw new Error(json.message || 'เกิดข้อผิดพลาด');
        return json;
    } catch (err) {
        if (!opts.silent) {
            const net = err instanceof TypeError;
            Swal.fire({ icon: 'error', title: net ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' : 'ทำรายการไม่สำเร็จ', text: net ? 'ตรวจสอบอินเทอร์เน็ต หรือที่อยู่ API ใน config.js' : err.message, confirmButtonText: 'ตกลง' });
        }
        throw err;
    } finally { progress(false); }
}
async function withBusy(btn, fn) {
    if (btn) btn.classList.add('busy');
    try { return await fn(); } catch { /* แจ้งเตือนแล้วใน api() */ } finally { if (btn) btn.classList.remove('busy'); }
}
function toast(msg, icon = 'success') {
    Swal.fire({ toast: true, position: 'top-end', icon, title: msg, showConfirmButton: false, timer: 2200, timerProgressBar: true });
}

/* ---------------------------------------------------------------------
   สถานะข้อมูล (อัปเดตเฉพาะส่วนที่เปลี่ยน ไม่ต้องโหลดใหม่ทั้งหมด)
   --------------------------------------------------------------------- */
function applyBootstrap(d) {
    Object.assign(S, { me: d.me, settings: d.settings, departments: d.departments, boxTypes: d.boxTypes, boxes: d.boxes, items: d.items, drugs: d.drugs, recentLogs: d.recentLogs, loaded: true });
}
function upsertItem(it) {
    const i = S.items.findIndex(x => x.id === it.id);
    if (i >= 0) S.items[i] = it; else S.items.push(it);
}
function upsertBoxes(list = []) {
    list.forEach(b => { const i = S.boxes.findIndex(x => x.id === b.id); if (i >= 0) S.boxes[i] = b; else S.boxes.push(b); });
}
async function refreshLogs() {
    try { const d = await api('bootstrap', {}, { silent: true }); S.recentLogs = d.recentLogs; S.drugs = d.drugs; } catch { /* ไม่เป็นไร */ }
}
const canEdit = boxOrDeptId => {
    if (!S.me) return false;
    if (S.me.isPharm) return true;
    const deptId = typeof boxOrDeptId === 'object' ? boxOrDeptId.departmentId : boxOrDeptId;
    return S.me.departmentId === deptId;
};
const itemsOf = boxId => S.items.filter(i => i.boxId === boxId);
const drugOf = it => byId(S.drugs, it.drugId);

/* =====================================================================
   เข้าสู่ระบบ
   ===================================================================== */
function showAuth(view = 'login') {
    $('#app-container').hidden = true;
    $('#auth-container').hidden = false;
    const card = $('#auth-card');
    if (view === 'login') {
        card.innerHTML = `
            <h2>เข้าสู่ระบบ</h2>
            <p class="lead">ใช้ Username และรหัสผ่านเดิมได้ทันที</p>
            <form id="f-login" autocomplete="on">
                <label class="field"><span>Username</span><input class="input" name="username" autocomplete="username" required></label>
                <label class="field"><span>Password</span><input class="input" type="password" name="password" autocomplete="current-password" required></label>
                <button class="btn primary" type="submit">เข้าสู่ระบบ</button>
            </form>
            <div class="auth-links"><a data-auth="forgot">ลืมรหัสผ่าน?</a><a data-auth="register">ลงทะเบียนใหม่</a></div>`;
        $('#f-login').onsubmit = async e => {
            e.preventDefault();
            const f = new FormData(e.target);
            await withBusy(e.submitter, async () => {
                const r = await api('login', { username: f.get('username').trim(), password: f.get('password') });
                localStorage.setItem(TOKEN_KEY, r.token);
                await startApp();
            });
        };
        setTimeout(() => $('#f-login [name=username]').focus(), 50);
    } else if (view === 'register') {
        card.innerHTML = `
            <h2>ลงทะเบียนใหม่</h2>
            <p class="lead">ผู้ดูแลระบบจะอนุมัติก่อนเริ่มใช้งาน</p>
            <form id="f-reg">
                <label class="field"><span>Username</span><input class="input" name="username" required autocomplete="username"></label>
                <label class="field"><span>ชื่อ-สกุล (ใช้ในช่องผู้ตรวจสอบ)</span><input class="input" name="displayName" required></label>
                <label class="field"><span>Password <small>อย่างน้อย 6 ตัวอักษร</small></span><input class="input" type="password" name="password" minlength="6" required autocomplete="new-password"></label>
                <label class="field"><span>E-mail</span><input class="input" type="email" name="email" required autocomplete="email"></label>
                <label class="field"><span>หน่วยงาน</span><select class="select input" name="departmentId" required><option value="">กำลังโหลด…</option></select></label>
                <label class="check"><input type="checkbox" name="pdpa" required> ข้าพเจ้ายินยอมให้เก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคล เพื่อวัตถุประสงค์ในการใช้งานระบบ JVL Drug Boxes ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA)</label>
                <br><button class="btn primary" type="submit">สมัครใช้งาน</button>
            </form>
            <div class="auth-links"><a data-auth="login">กลับไปหน้าเข้าสู่ระบบ</a></div>`;
        api('public_master', {}, { silent: true }).then(r => {
            $('#f-reg [name=departmentId]').innerHTML = '<option value="">เลือกหน่วยงาน</option>' + r.departments.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
        }).catch(() => {});
        $('#f-reg').onsubmit = async e => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.target));
            await withBusy(e.submitter, async () => {
                const r = await api('register', { ...f, pdpa: !!f.pdpa });
                await Swal.fire({ icon: 'success', title: 'ลงทะเบียนแล้ว', text: r.message, confirmButtonText: 'ตกลง' });
                showAuth('login');
            });
        };
    } else if (view === 'forgot') {
        card.innerHTML = `
            <h2>ตั้งรหัสผ่านใหม่</h2>
            <p class="lead">ระบบจะส่งรหัสยืนยัน 6 หลักไปที่อีเมลที่ลงทะเบียนไว้</p>
            <form id="f-forgot">
                <label class="field"><span>E-mail</span><input class="input" type="email" name="email" required></label>
                <button class="btn primary" type="submit">ส่งรหัสยืนยัน</button>
            </form>
            <form id="f-reset" hidden>
                <label class="field"><span>รหัสยืนยัน 6 หลัก</span><input class="input" name="code" inputmode="numeric" maxlength="6" required></label>
                <label class="field"><span>รหัสผ่านใหม่</span><input class="input" type="password" name="newPassword" minlength="6" required autocomplete="new-password"></label>
                <button class="btn primary" type="submit">ตั้งรหัสผ่านใหม่</button>
            </form>
            <div class="auth-links"><a data-auth="login">กลับไปหน้าเข้าสู่ระบบ</a></div>`;
        let email = '';
        $('#f-forgot').onsubmit = async e => {
            e.preventDefault(); email = new FormData(e.target).get('email').trim();
            await withBusy(e.submitter, async () => {
                const r = await api('forgot_request', { email });
                toast(r.message, 'info'); $('#f-forgot').hidden = true; $('#f-reset').hidden = false;
            });
        };
        $('#f-reset').onsubmit = async e => {
            e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
            await withBusy(e.submitter, async () => {
                const r = await api('forgot_confirm', { email, ...f });
                await Swal.fire({ icon: 'success', text: r.message, confirmButtonText: 'เข้าสู่ระบบ' });
                showAuth('login');
            });
        };
    }
    $$('[data-auth]', card).forEach(a => a.onclick = () => showAuth(a.dataset.auth));
}

function forceLogout(msg) {
    localStorage.removeItem(TOKEN_KEY);
    S.me = null; S.loaded = false;
    showAuth('login');
    if (msg) toast(msg, 'info');
}
async function logout() {
    try { await api('logout', {}, { silent: true }); } catch { /* ไม่เป็นไร */ }
    forceLogout();
}

async function startApp() {
    $('#auth-container').hidden = true;
    $('#app-container').hidden = false;
    $('#view').innerHTML = skeleton();
    const d = await api('bootstrap');
    applyBootstrap(d);
    renderChrome();
    if (!location.hash || location.hash === '#') location.hash = '#/dashboard'; else route();
}
function skeleton() {
    return `<div class="sk" style="height:34px;width:40%;margin-bottom:22px"></div>
            <div class="sk" style="height:58px;margin-bottom:22px"></div>
            <div class="sk" style="height:420px"></div>`;
}

/* =====================================================================
   โครงหน้า: เมนู, ผู้ใช้, ค้นหา
   ===================================================================== */
const NAV = [
    { r: 'dashboard', i: 'fa-table-cells-large', t: 'หน้าหลัก' },
    { r: 'boxes', i: 'fa-briefcase-medical', t: 'กล่องยา' },
    { r: 'list', i: 'fa-pills', t: 'รายการยา' },
    { r: 'calendar', i: 'fa-calendar-days', t: 'ปฏิทินวันหมดอายุ', short: 'ปฏิทิน' },
    { r: 'reports', i: 'fa-chart-column', t: 'รายงานวิเคราะห์' },
    { r: 'manual', i: 'fa-book-medical', t: 'คู่มือบริหารยา' },
    { r: 'settings', i: 'fa-gear', t: 'ตั้งค่า' },
];
function renderChrome() {
    const sent = S.boxes.filter(b => b.status === 'ส่งปรับแก้').length;
    const risk = S.items.filter(i => i.expStatus === 'expired' || i.expStatus === 'exp3m').length;
    const pill = { boxes: sent, list: risk };
    $('#nav').innerHTML = NAV.map((n, i) => `${i === 6 ? '<div class="sep"></div>' : ''}<a href="#/${n.r}" data-r="${n.r}"><i class="fas ${n.i}"></i>${n.t}${pill[n.r] ? `<span class="pill" title="ต้องดำเนินการ">${pill[n.r]}</span>` : ''}</a>`).join('');
    const tabs = [NAV[0], NAV[1], NAV[2], NAV[3], { r: 'more', i: 'fa-bars', t: 'เมนู' }];
    $('#tabbar').innerHTML = tabs.map(n => `<a href="#/${n.r}" data-r="${n.r}"><i class="fas ${n.i}"></i>${n.short || n.t}${pill[n.r] ? `<span class="pill">${pill[n.r]}</span>` : ''}</a>`).join('');
    const me = S.me;
    $('#me-card').innerHTML = `<span class="av">${esc((me.displayName || me.username).trim().charAt(0))}</span>
        <div><b>${esc(me.displayName || me.username)}</b><small>${esc(roleName(me.role))}${me.department ? ' · ' + esc(shortDept(me.departmentId)) : ''}</small></div>
        <button title="ออกจากระบบ" aria-label="ออกจากระบบ" id="btn-logout"><i class="fas fa-right-from-bracket"></i></button>`;
    $('#btn-logout').onclick = logout;
    const t = new Date();
    $('#today-label').textContent = `วัน${['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'][t.getDay()]}ที่ ${t.getDate()} ${THAI_MONTHS[t.getMonth()]} ${t.getFullYear() + 543}`;
    highlightNav();
}
const roleName = r => ({ 'God Admin': 'ผู้ดูแลระบบ', Admin: 'ผู้ดูแลระบบ', Pharmacist: 'เภสัชกร', User: 'ผู้ใช้งานหอผู้ป่วย' }[r] || r);
const shortDept = id => (byId(S.departments, id) || {}).short || '';
function highlightNav() {
    const r = (location.hash.split('/')[1] || 'dashboard').split('?')[0];
    const map = { box: 'boxes' };
    $$('#nav a, #tabbar a').forEach(a => a.classList.toggle('on', a.dataset.r === (map[r] || r)));
}

/* ---------- ค้นหาทั่วระบบ (ยา, Lot, กล่อง) ---------- */
function setupSearch() {
    const inp = $('#global-search'), box = $('#search-results');
    let sel = -1;
    const run = () => {
        const q = inp.value.trim();
        if (!q) { box.hidden = true; return; }
        const nq = norm(q);
        const boxes = S.boxes.filter(b => norm(b.name).includes(nq) || norm(b.deptShort).includes(nq)).slice(0, 5);
        const items = S.items.filter(it => {
            const d = drugOf(it);
            return norm(it.drugName).includes(nq) || norm(it.lotNumber).includes(nq) || (d && d.aliases.some(a => norm(a).includes(nq)));
        }).sort((a, b) => (a.expireDate || '9') < (b.expireDate || '9') ? -1 : 1).slice(0, 14);
        if (!boxes.length && !items.length) { box.innerHTML = `<div class="empty">ไม่พบ "${esc(q)}" ในชื่อยา, Lot หรือชื่อกล่อง</div>`; box.hidden = false; return; }
        box.innerHTML = (boxes.length ? `<div class="grp">กล่องยา</div>` + boxes.map(b => `<a data-href="#/box/${b.id}"><i class="fas fa-briefcase-medical faint"></i><span>${esc(b.name)}<small>${esc(b.department)}</small></span></a>`).join('') : '')
            + (items.length ? `<div class="grp">รายการยา (${items.length === 14 ? '14+' : items.length})</div>` + items.map(it => {
                const b = byId(S.boxes, it.boxId);
                return `<a data-href="#/box/${it.boxId}?hl=${it.id}"><span style="flex:1">${esc(it.drugName)}<small>Lot ${esc(it.lotNumber || '-')} · ${esc(b ? b.name : '')}</small></span>${expChip(it)}</a>`;
            }).join('') : '')
            + (items.length ? `<a data-href="#/list/all?q=${encodeURIComponent(q)}"><i class="fas fa-list faint"></i><span>ดูผลค้นหาทั้งหมดในหน้ารายการยา</span></a>` : '');
        box.hidden = false; sel = -1;
        $$('a', box).forEach(a => a.onmousedown = e => { e.preventDefault(); go(a.dataset.href); });
    };
    const go = href => { box.hidden = true; inp.value = ''; inp.blur(); location.hash = href; };
    inp.addEventListener('input', debounce(run, 120));
    inp.addEventListener('focus', run);
    inp.addEventListener('blur', () => setTimeout(() => box.hidden = true, 150));
    inp.addEventListener('keydown', e => {
        const links = $$('a', box);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
            links.forEach((a, i) => a.classList.toggle('on', i === sel)); links[sel]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter' && links.length) { go(links[Math.max(sel, 0)].dataset.href); }
        else if (e.key === 'Escape') { inp.blur(); }
    });
    document.addEventListener('keydown', e => {
        if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !$('#app-container').hidden) { e.preventDefault(); inp.focus(); }
    });
}

/* =====================================================================
   Router
   ===================================================================== */
function route() {
    if (!S.loaded) return;
    closeDrawer(true);
    UI.charts.forEach(c => c.destroy()); UI.charts = [];
    const [path, qs] = location.hash.slice(2).split('?');
    const parts = path.split('/');
    const params = new URLSearchParams(qs || '');
    const v = $('#view');
    const views = {
        dashboard: viewDashboard, boxes: viewBoxes, box: () => viewBox(Number(parts[1]), params), list: () => viewList(parts[1] || 'all', params),
        calendar: viewCalendar, reports: viewReports, manual: () => viewManual(parts[1] ? decodeURIComponent(parts[1]) : null),
        settings: () => viewSettings(parts[1] || 'profile'), more: viewMore,
    };
    (views[parts[0]] || viewDashboard)(v);
    highlightNav();
    if (!params.get('hl')) window.scrollTo(0, 0);
    v.focus({ preventScroll: true });
}
window.addEventListener('hashchange', route);
function rerender() { const y = window.scrollY; route(); window.scrollTo(0, y); renderChrome(); }

/* =====================================================================
   หน้าหลัก — กระดานความพร้อมกล่องยา
   ===================================================================== */
function viewDashboard(v) {
    const c = { expired: 0, exp3m: 0, exp6m: 0 };
    S.items.forEach(i => { if (c[i.expStatus] !== undefined) c[i.expStatus]++; });
    const qty = S.items.reduce((s, i) => s + (i.qty || 0), 0);
    const sent = S.boxes.filter(b => b.status === 'ส่งปรับแก้');
    const expiredBoxes = [...new Set(S.items.filter(i => i.expStatus === 'expired').map(i => i.boxId))].map(id => byId(S.boxes, id)).filter(Boolean);

    let alerts = '';
    if (c.expired) alerts += `<a class="alert expired" href="#/list/expired"><i class="fas fa-circle-exclamation"></i><span><b>มียาหมดอายุแล้ว ${c.expired} รายการ</b> ใน ${expiredBoxes.map(b => esc(b.name)).join(', ')}</span><span class="go">ดูรายการ</span></a>`;
    if (sent.length) alerts += `<a class="alert sent" href="#/boxes?status=sent"><i class="fas fa-box-open"></i><span><b>กล่องรอเภสัชฯ ปรับแก้ ${sent.length} กล่อง</b> ${sent.map(b => esc(b.name)).join(', ')}</span><span class="go">ดูกล่อง</span></a>`;
    const soon = S.items.filter(i => i.expStatus === 'exp3m' && i.daysLeft !== null && i.daysLeft <= 30).length;
    if (soon) alerts += `<a class="alert exp3m" href="#/list/exp3m?within=30"><i class="fas fa-hourglass-half"></i><span><b>${soon} รายการจะหมดอายุภายใน 30 วัน</b> ควรเตรียมยาทดแทน</span><span class="go">ดูรายการ</span></a>`;

    v.innerHTML = `
        <div class="page-head"><div><h1>ความพร้อมกล่องยา</h1><p>สถานะกล่องยาทุกหอผู้ป่วย ณ วันนี้ เรียงตามประเภทกล่อง</p></div></div>
        ${alerts ? `<div class="alerts">${alerts}</div>` : ''}
        ${boardHtml()}
        <div class="stats">
            <a class="stat" href="#/boxes"><small>กล่องยา</small><b>${S.boxes.length}</b><em>${S.departments.filter(d => S.boxes.some(b => b.departmentId === d.id)).length} หน่วยงาน</em></a>
            <a class="stat" href="#/list/all"><small>รายการยา (Lot)</small><b>${S.items.length}</b><em>${new Set(S.items.map(i => i.drugId)).size} ชนิด</em></a>
            <a class="stat" href="#/reports"><small>จำนวนชิ้นรวม</small><b>${qty.toLocaleString()}</b><em>ทุกกล่อง</em></a>
            <a class="stat expired" href="#/list/expired"><small>หมดอายุแล้ว</small><b>${c.expired}</b><em>รายการ</em></a>
            <a class="stat exp3m" href="#/list/exp3m"><small>หมดอายุ &lt; 3 เดือน</small><b>${c.exp3m}</b><em>รายการ</em></a>
            <a class="stat exp6m" href="#/list/exp6m"><small>หมดอายุ 3-6 เดือน</small><b>${c.exp6m}</b><em>รายการ</em></a>
        </div>
        <div class="panel section">
            <div class="panel-head"><h2>ทำรายการล่าสุด</h2><a class="btn sm ghost" href="#/reports?tab=logs">ประวัติทั้งหมด</a></div>
            ${timelineHtml(S.recentLogs)}
        </div>`;
}

function boardHtml() {
    const types = S.boxTypes.filter(t => S.boxes.some(b => b.boxTypeId === t.id));
    const depts = S.departments.filter(d => S.boxes.some(b => b.departmentId === d.id));
    let html = `<section class="board">
        <div class="board-head"><div><h2>กระดานกล่องยา</h2><p>แถบสีแสดงระยะเวลาก่อนถึงวันหมดอายุกล่อง (ยาที่หมดเร็วที่สุด − 1 เดือน)</p></div>
            <div class="legend"><span><i style="background:${ST_COLOR.expired}"></i>มียาหมดอายุ</span><span><i style="background:${ST_COLOR.exp3m}"></i>&lt; 3 เดือน</span><span><i style="background:${ST_COLOR.exp6m}"></i>3-6 เดือน</span><span><i style="background:${ST_COLOR.ok}"></i>ปกติ</span></div></div>
        <div class="board-grid" style="--cols:${types.length}">
            <div class="bh">หอผู้ป่วย</div>${types.map(t => `<div class="bh"><i style="background:${esc(t.color)}"></i>${esc(t.name)}</div>`).join('')}`;
    depts.forEach(d => {
        const dBoxes = S.boxes.filter(b => b.departmentId === d.id);
        html += `<div class="ward" style="--c:${esc(d.color)}"><b>${esc(d.short)}</b><small>${dBoxes.reduce((s, b) => s + b.itemCount, 0)} รายการ</small></div>`;
        types.forEach(t => {
            const bs = dBoxes.filter(b => b.boxTypeId === t.id);
            html += `<div class="cell${bs.length ? '' : ' na'}">${bs.map(b => slotHtml(b, true)).join('')}</div>`;
        });
    });
    return html + '</div></section>';
}
function slotHtml(b, compact) {
    const today = parseYmd(S.settings.today) || new Date();
    const exp = parseYmd(b.boxExp);
    const days = exp ? Math.round((exp - today) / 864e5) : null;
    const pct = days === null ? 0 : days < 0 ? 100 : Math.max(4, Math.min(100, days / 365 * 100));
    const name = compact ? b.name.replace(b.deptShort, '').replace(/box/i, '').trim() || b.name : b.name;
    const t = byId(S.boxTypes, b.boxTypeId);
    const n = b.counts;
    return `<a class="slot" data-st="${b.worst}" href="#/box/${b.id}" title="${esc(b.name)} — ${esc(ST_LABEL[b.worst])}">
        ${b.status === 'ส่งปรับแก้' ? '<span class="sent">รอเภสัชฯ</span>' : ''}
        <span class="nm" data-type="${esc(t ? t.name : '')}">${esc(name)}</span>
        <span class="dt${days !== null && days < 0 ? ' over' : ''}">${b.boxExp ? (days < 0 ? 'เลยวัน Exp ' : 'Exp ') + thDate(b.boxExp, true) : 'ไม่มีข้อมูล'}</span>
        <span class="runway"><i style="width:${pct}%"></i></span>
        <span class="meta">${compact ? '' : deptBadge(b.departmentId)}<span>${b.itemCount} รายการ</span>
            ${n.expired ? `<span class="n" style="--d:${ST_COLOR.expired}">${n.expired} หมดอายุ</span>` : ''}
            ${n.exp3m ? `<span class="n" style="--d:${ST_COLOR.exp3m}">${n.exp3m} &lt;3ด.</span>` : ''}
            ${n.exp6m ? `<span class="n" style="--d:${ST_COLOR.exp6m}">${n.exp6m} 3-6ด.</span>` : ''}
            ${!compact && b.stockTakeAt ? `<span>ตรวจล่าสุด ${thDate(b.stockTakeAt.slice(0, 10), true)}</span>` : ''}
        </span></a>`;
}
function timelineHtml(logs) {
    if (!logs.length) return `<div class="empty-state"><i class="fas fa-clock-rotate-left"></i>ยังไม่มีประวัติการทำรายการ</div>`;
    return `<ul class="timeline">${logs.map(l => `<li><time>${thDateTime(l.timestamp)}</time><div><span class="act" style="background:${ACT_COLOR[l.action] || '#7f8c8d'}">${esc(ACT_LABEL[l.action] || l.action)}</span>${esc(l.details)} <span class="who">— ${esc(l.user || '-')}</span></div></li>`).join('')}</ul>`;
}

/* =====================================================================
   กล่องยาทั้งหมด
   ===================================================================== */
function viewBoxes(v) {
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const f = UI.boxFilter || (UI.boxFilter = { dept: 'all', type: 'all', sort: 'ward', status: params.get('status') === 'sent' ? 'sent' : 'all' });
    if (params.get('status') === 'sent') f.status = 'sent';
    v.innerHTML = `
        <div class="page-head"><div><h1>กล่องยา</h1><p>เลือกกล่องเพื่อดูรายการยา แก้ไข หรือพิมพ์ป้าย</p></div>
            ${S.me.isAdmin ? `<div class="actions"><a class="btn" href="#/settings/boxes"><i class="fas fa-plus"></i> เพิ่ม/แก้ไขกล่อง</a></div>` : ''}</div>
        <div class="filters">
            <select class="select" id="fb-dept"><option value="all">ทุกหน่วยงาน</option>${S.departments.filter(d => S.boxes.some(b => b.departmentId === d.id)).map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select>
            <select class="select" id="fb-type"><option value="all">ทุกประเภทกล่อง</option>${S.boxTypes.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>
            <select class="select" id="fb-status"><option value="all">ทุกสถานะ</option><option value="sent">รอเภสัชฯ ปรับแก้</option><option value="risk">มียาหมดอายุ/ใกล้หมด</option></select>
            <div class="seg" role="group" aria-label="เรียงลำดับ"><button data-s="ward">ตามหอผู้ป่วย</button><button data-s="exp">ตามวันหมดอายุกล่อง</button></div>
            <button class="btn ghost" id="fb-reset"><i class="fas fa-rotate-left"></i> ล้างตัวกรอง</button>
        </div>
        <div class="box-grid" id="box-grid"></div>`;
    const draw = () => {
        let bs = S.boxes.filter(b => (f.dept === 'all' || b.departmentId === +f.dept) && (f.type === 'all' || b.boxTypeId === +f.type)
            && (f.status === 'all' || (f.status === 'sent' ? b.status === 'ส่งปรับแก้' : ['expired', 'exp3m'].includes(b.worst))));
        if (f.sort === 'exp') bs = [...bs].sort((a, b) => (a.boxExp || '9999') < (b.boxExp || '9999') ? -1 : 1);
        $('#box-grid').innerHTML = bs.length ? bs.map(b => slotHtml(b, false)).join('')
            : `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-box"></i>ไม่พบกล่องยาที่ตรงกับตัวกรอง</div>`;
        $$('.seg button', v).forEach(b => b.classList.toggle('on', b.dataset.s === f.sort));
    };
    $('#fb-dept').value = f.dept; $('#fb-type').value = f.type; $('#fb-status').value = f.status;
    $('#fb-dept').onchange = e => { f.dept = e.target.value; draw(); };
    $('#fb-type').onchange = e => { f.type = e.target.value; draw(); };
    $('#fb-status').onchange = e => { f.status = e.target.value; draw(); };
    $$('.seg button', v).forEach(b => b.onclick = () => { f.sort = b.dataset.s; draw(); });
    $('#fb-reset').onclick = () => { Object.assign(f, { dept: 'all', type: 'all', status: 'all', sort: 'ward' }); viewBoxes(v); };
    draw();
}

/* =====================================================================
   รายละเอียดกล่อง
   ===================================================================== */
function viewBox(boxId, params) {
    const v = $('#view');
    const b = byId(S.boxes, boxId);
    if (!b) { v.innerHTML = `<a class="back" href="#/boxes"><i class="fas fa-arrow-left"></i> กล่องยาทั้งหมด</a><div class="empty-state"><i class="fas fa-box"></i>ไม่พบกล่องยานี้</div>`; return; }
    const edit = canEdit(b);
    const sortKey = UI.sort.box || { col: 'drugName', asc: true };
    let items = itemsOf(boxId);
    items = sortRows(items, sortKey.col, sortKey.asc);
    const hl = Number(params.get('hl')) || null;
    const t = byId(S.boxTypes, b.boxTypeId);
    const sentByMe = b.status === 'ส่งปรับแก้';

    v.innerHTML = `
        <a class="back" href="#/boxes"><i class="fas fa-arrow-left"></i> กล่องยาทั้งหมด</a>
        <section class="box-hero" data-st="${b.worst}">
            <div>
                ${deptBadge(b.departmentId)} <span class="tag">${esc(t ? t.name : b.boxType)}</span>
                <h1>${esc(b.name)}</h1>
                <div class="facts">
                    <span><b>${b.itemCount}</b> รายการ · <b>${b.qtyTotal}</b> ชิ้น</span>
                    <span>ตรวจกล่องล่าสุด <b>${b.stockTakeAt ? thDateTime(b.stockTakeAt) : 'ยังไม่เคยบันทึก'}</b>${b.stockTakeBy ? ` โดย ${esc(b.stockTakeBy)}` : ''}</span>
                    ${b.counts.expired ? `<span style="color:${ST_COLOR.expired}"><b>${b.counts.expired}</b> รายการหมดอายุแล้ว</span>` : ''}
                    ${b.counts.exp3m ? `<span style="color:${ST_COLOR.exp3m}"><b>${b.counts.exp3m}</b> รายการหมดอายุภายใน 3 เดือน</span>` : ''}
                </div>
                ${sentByMe ? `<div class="box-status"><i class="fas fa-box-open"></i> ส่งให้เภสัชฯ ปรับแก้เมื่อ ${thDateTime(b.statusAt)}${b.statusBy ? ' โดย ' + esc(b.statusBy) : ''}${b.statusNote ? ` — "${esc(b.statusNote)}"` : ''}</div>` : ''}
            </div>
            <div class="boxexp"><small>วันที่กล่อง Expire</small><b>${b.boxExp ? thDate(b.boxExp) : '-'}</b><em>${b.boxExp && b.boxExp < S.settings.today ? '<span style="color:var(--st-exp3m);font-weight:600">เลยวันหมดอายุกล่องแล้ว ควรเปลี่ยนยาและพิมพ์ป้ายใหม่</span><br>' : ''}${b.earliestExp ? `ยาหมดเร็วสุด ${thDate(b.earliestExp)}` : ''}</em></div>
        </section>

        <div class="toolbar">
            ${edit ? `<button class="btn primary" id="b-add"><i class="fas fa-plus"></i> เพิ่มยา</button>` : ''}
            ${edit ? `<button class="btn" id="b-stk" title="ยืนยันว่าตรวจยา จำนวน และวันหมดอายุในกล่องตรงกับของจริงแล้ว"><i class="fas fa-clipboard-check"></i> ยืนยันตรวจกล่องครบ</button>` : ''}
            ${edit && !sentByMe ? `<button class="btn danger" id="b-send"><i class="fas fa-paper-plane"></i> ส่งเภสัชฯ ปรับแก้</button>` : ''}
            ${S.me.isPharm && sentByMe ? `<button class="btn solid-ok" id="b-clear"><i class="fas fa-circle-check"></i> เคลียร์สถานะ (ปรับแก้แล้ว)</button>` : ''}
            <span class="grow"></span>
            <div class="menu">
                <button class="btn" id="b-print" aria-haspopup="true"><i class="fas fa-print"></i> พิมพ์ <i class="fas fa-chevron-down" style="font-size:11px"></i></button>
                <div class="menu-list" id="b-print-menu" hidden>
                    <button data-p="label"><i class="fas fa-tag"></i> ป้ายกล่อง (A4 แนวนอน 2 ฝั่ง)</button>
                    <button data-p="sticker"><i class="fas fa-note-sticky"></i> สติ๊กเกอร์แปะซองยา (ติ๊กเลือกรายการ)</button>
                    <button data-p="report"><i class="fas fa-file-lines"></i> รายงานสถานะกล่อง</button>
                    <button data-p="csv"><i class="fas fa-file-csv"></i> Export Excel (CSV)</button>
                </div>
            </div>
        </div>

        <div class="panel"><div class="tbl-wrap"><table class="tbl cards" id="box-tbl">
            <thead><tr>
                <th style="width:40px"><input type="checkbox" id="chk-all" title="เลือกทั้งหมดสำหรับพิมพ์สติ๊กเกอร์" aria-label="เลือกทั้งหมด"></th>
                ${th('drugName', 'ชื่อยา', 'box')}${th('lotNumber', 'Lot', 'box')}${th('storageLoc', 'แหล่งเก็บ', 'box')}${th('expireDate', 'วันหมดอายุ', 'box')}${th('qty', 'จำนวน', 'box', 'num')}
                <th></th></tr></thead>
            <tbody>${items.length ? items.map(it => itemRow(it, edit, it.id === hl)).join('') : `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-pills"></i>ยังไม่มีรายการยาในกล่องนี้${edit ? '<br><br><button class="btn primary" onclick="openItemDrawer(' + b.id + ')"><i class="fas fa-plus"></i> เพิ่มยารายการแรก</button>' : ''}</div></td></tr>`}</tbody>
        </table></div></div>`;

    bindSort(v, 'box', () => viewBox(boxId, new URLSearchParams()));
    $('#chk-all').onchange = e => $$('.sticker-checkbox', v).forEach(c => c.checked = e.target.checked);
    if (edit) {
        $('#b-add').onclick = () => openItemDrawer(b.id);
        $('#b-stk').onclick = e => doStockTake(b, e.currentTarget);
        if ($('#b-send')) $('#b-send').onclick = e => sendBox(b, e.currentTarget);
    }
    if ($('#b-clear')) $('#b-clear').onclick = e => clearBox(b, e.currentTarget);
    const menu = $('#b-print-menu');
    $('#b-print').onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; };
    document.addEventListener('click', () => menu.hidden = true, { once: true });
    $$('button', menu).forEach(m => m.onclick = () => {
        menu.hidden = true;
        ({ label: () => printBoxLabel(b), sticker: () => printStickers(b), report: () => printBoxReport(b), csv: () => exportItemsCsv(itemsOf(b.id), b.name) })[m.dataset.p]();
    });
    bindItemActions(v);
    if (hl) { const r = $(`tr[data-id="${hl}"]`, v); if (r) setTimeout(() => r.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50); }
}
function th(col, label, key, cls = '') {
    const s = UI.sort[key] || {};
    const icon = s.col === col ? (s.asc ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort';
    return `<th class="sortable ${cls}" data-col="${col}">${label}<i class="fas ${icon}"></i></th>`;
}
function bindSort(root, key, redraw) {
    $$('th.sortable', root).forEach(h => h.onclick = () => {
        const s = UI.sort[key] || {};
        UI.sort[key] = { col: h.dataset.col, asc: s.col === h.dataset.col ? !s.asc : true };
        redraw();
    });
}
function sortRows(rows, col, asc) {
    const val = r => {
        if (col === 'department') { const b = byId(S.boxes, r.boxId); return b ? (byId(S.departments, b.departmentId)?.short || '') + b.name : ''; }
        if (col === 'boxName') { const b = byId(S.boxes, r.boxId); return b ? b.name : ''; }
        const x = r[col]; return x === null || x === undefined ? (col === 'expireDate' ? '9999' : '') : x;
    };
    return [...rows].sort((a, b) => {
        const x = val(a), y = val(b);
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'th', { numeric: true });
        return asc ? c : -c;
    });
}
function itemRow(it, edit, hl) {
    const sub = [];
    if (it.openedAt) sub.push(`แกะซอง ${thDate(it.openedAt, true)}`);
    sub.push(`อัปเดต ${thDate((it.updatedAt || '').slice(0, 10), true)}${it.verifiedBy ? ' โดย ' + esc(it.verifiedBy) : ''}`);
    return `<tr data-id="${it.id}"${hl ? ' style="outline:2px solid var(--gold);outline-offset:-2px"' : ''}>
        <td class="chk"><input type="checkbox" class="sticker-checkbox" value="${it.id}" aria-label="เลือก ${esc(it.drugName)}"></td>
        <td class="drug"><b>${esc(it.drugName)}</b><small>${sub.join(' · ')}</small></td>
        <td data-l="Lot">${esc(it.lotNumber || '-')}</td>
        <td data-l="แหล่งเก็บ"><span class="tag">${esc(it.storageLoc)}</span></td>
        <td data-l="หมดอายุ">${expChip(it)} <small class="faint nowrap">${it.expireDate ? daysText(it.daysLeft) : ''}</small></td>
        <td data-l="จำนวน" class="num"><b>${it.qty ?? '-'}</b> <small class="faint">${esc(it.unit || '')}</small></td>
        <td class="acts">${edit ? `
            ${it.canOpenPkg ? `<button class="btn sm" data-a="open" title="แกะซอง (ปรับวันหมดอายุตามอายุหลังเปิด)"><i class="fas fa-scissors"></i></button>` : ''}
            <button class="btn sm" data-a="verify" title="ตรวจแล้วถูกต้อง"><i class="fas fa-check"></i></button>
            <button class="btn sm" data-a="edit" title="แก้ไข"><i class="fas fa-pen"></i></button>
            <button class="btn sm danger" data-a="del" title="ลบ"><i class="fas fa-trash"></i></button>` : ''}</td>
    </tr>`;
}
function bindItemActions(root) {
    $$('tr[data-id] [data-a]', root).forEach(btn => btn.onclick = e => {
        const it = byId(S.items, btn.closest('tr').dataset.id);
        ({ edit: () => openItemDrawer(it.boxId, it), verify: () => verifyItem(it, btn), del: () => deleteItem(it, btn), open: () => openPackage(it, btn) })[btn.dataset.a]();
        e.stopPropagation();
    });
}

/* ---------- การกระทำกับรายการยา ---------- */
async function verifyItem(it, btn) {
    await withBusy(btn, async () => { const r = await api('item_verify', { id: it.id }); upsertItem(r.item); toast('บันทึกการตรวจสอบแล้ว'); rerender(); refreshLogs(); });
}
async function deleteItem(it, btn) {
    const b = byId(S.boxes, it.boxId);
    const ok = await Swal.fire({ icon: 'warning', title: 'ลบรายการยา?', html: `<b>${esc(it.drugName)}</b><br>Lot ${esc(it.lotNumber || '-')} ออกจาก ${esc(b.name)}<br><small class="muted">ประวัติการลบจะถูกเก็บไว้ในระบบ</small>`, showCancelButton: true, confirmButtonText: 'ลบรายการ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#D64535' });
    if (!ok.isConfirmed) return;
    await withBusy(btn, async () => {
        const r = await api('item_delete', { id: it.id });
        S.items = S.items.filter(x => x.id !== it.id); upsertBoxes(r.boxes); toast('ลบรายการแล้ว'); rerender(); refreshLogs();
    });
}
async function openPackage(it, btn) {
    const d = drugOf(it);
    const { value } = await Swal.fire({
        title: 'แกะซองยา', input: 'date', inputValue: ymd(new Date()), inputAttributes: { max: ymd(new Date()) },
        html: `ระบุวันที่แกะซอง <b>${esc(it.drugName)}</b><br>วันหมดอายุใหม่ = วันที่แกะ + ${d?.openedShelfLifeDays || 90} วัน<br><small class="muted">แต่ไม่เกินวันหมดอายุข้างกล่อง (${thDate(it.mfgExpDate || it.expireDate)})</small>`,
        showCancelButton: true, confirmButtonText: 'บันทึกการแกะซอง', cancelButtonText: 'ยกเลิก',
    });
    if (!value) return;
    await withBusy(btn, async () => {
        const r = await api('item_open_package', { id: it.id, openDate: value });
        upsertItem(r.item); upsertBoxes(r.boxes); rerender(); refreshLogs();
        Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', text: r.message, confirmButtonText: 'ตกลง' });
    });
}
async function doStockTake(b, btn) {
    const ok = await Swal.fire({ icon: 'question', title: 'ยืนยันการตรวจกล่อง', text: `ยืนยันว่าตรวจรายการยา จำนวน และวันหมดอายุใน ${b.name} ตรงกับของจริงแล้ว`, showCancelButton: true, confirmButtonText: 'ยืนยัน ตรวจครบแล้ว', cancelButtonText: 'ยกเลิก' });
    if (!ok.isConfirmed) return;
    await withBusy(btn, async () => { const r = await api('box_stock_take', { boxId: b.id }); upsertBoxes(r.boxes); toast(r.message); rerender(); refreshLogs(); });
}
async function sendBox(b, btn) {
    const { value, isConfirmed } = await Swal.fire({
        icon: 'warning', title: 'ส่งกล่องให้เภสัชฯ ปรับแก้', input: 'textarea', inputLabel: 'บอกเภสัชกรว่าต้องแก้อะไร (ไม่บังคับ)', inputPlaceholder: 'เช่น ใช้ Adrenaline ไป 2 amp, ยาหมดอายุ 1 รายการ',
        showCancelButton: true, confirmButtonText: 'ส่งกล่อง', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#D64535',
    });
    if (!isConfirmed) return;
    await withBusy(btn, async () => { const r = await api('box_status', { boxId: b.id, status: 'ส่งปรับแก้', note: value }); upsertBoxes(r.boxes); toast('ส่งกล่องแล้ว ระบบแจ้งเภสัชฯ ทาง LINE'); rerender(); refreshLogs(); });
}
async function clearBox(b, btn) {
    const ok = await Swal.fire({ icon: 'question', title: 'เคลียร์สถานะกล่อง', text: `ยืนยันว่าปรับแก้ ${b.name} เรียบร้อยแล้ว`, showCancelButton: true, confirmButtonText: 'เคลียร์สถานะ', cancelButtonText: 'ยกเลิก' });
    if (!ok.isConfirmed) return;
    await withBusy(btn, async () => { const r = await api('box_status', { boxId: b.id, status: 'ปกติ' }); upsertBoxes(r.boxes); toast(r.message); rerender(); refreshLogs(); });
}

/* =====================================================================
   Drawer เพิ่ม/แก้ไขรายการยา
   ===================================================================== */
function openDrawer(html) {
    $('#drawer').innerHTML = html;
    $('#drawer').hidden = false; $('#drawer-backdrop').hidden = false;
    $('#drawer-backdrop').onclick = () => closeDrawer();
    document.body.style.overflow = 'hidden';
    $$('[data-close]', $('#drawer')).forEach(b => b.onclick = () => closeDrawer());
}
function closeDrawer(silent) {
    if ($('#drawer').hidden) return;
    UI.ts.forEach(t => t.destroy()); UI.ts = [];
    $('#drawer').hidden = true; $('#drawer-backdrop').hidden = true; $('#drawer').innerHTML = '';
    document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#drawer').hidden && !$('.ts-dropdown:not([style*="display: none"])', $('#drawer'))) closeDrawer(); }, true);

function openItemDrawer(boxId, it = null) {
    const b = byId(S.boxes, boxId);
    if (!canEdit(b)) return;
    const drugs = S.drugs.filter(d => d.isActive || (it && d.id === it.drugId));
    openDrawer(`
        <div class="drawer-head"><div><h2>${it ? 'แก้ไขรายการยา' : 'เพิ่มยาเข้ากล่อง'}</h2><p>${esc(b.name)}</p></div><button class="btn icon ghost" data-close aria-label="ปิด"><i class="fas fa-xmark"></i></button></div>
        <form class="drawer-body" id="f-item">
            <div class="field"><span>ชื่อยา</span><select id="fi-drug" placeholder="พิมพ์ชื่อยาเพื่อค้นหา" aria-label="ชื่อยา"><option value=""></option>${drugs.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select>
                <small id="fi-cond"></small></div>
            <div class="row">
                <label class="field"><span>Lot</span><input class="input" name="lotNumber" value="${esc(it?.lotNumber || '')}" autocomplete="off"></label>
                <label class="field"><span>จำนวน <b id="fi-unit" style="color:var(--green)"></b></span><input class="input" name="qty" type="number" min="0" inputmode="numeric" value="${it?.qty ?? ''}"></label>
            </div>
            <label class="field"><span>แหล่งเก็บ</span><select class="select input" name="storageLoc">${STORAGES.map(s => `<option${(it?.storageLoc || STORAGES[0]) === s ? ' selected' : ''}>${s}</option>`).join('')}</select></label>
            <label class="field"><span>วันหมดอายุที่ระบุข้างขวด/แผง</span><input class="input" type="date" name="expireDate" value="${esc(it?.expireDate || '')}"><small id="fi-exp-hint"></small></label>
            ${it?.openedAt ? `<div class="hint"><i class="fas fa-scissors"></i> แกะซองเมื่อ ${thDate(it.openedAt)} (วันหมดอายุข้างกล่อง ${thDate(it.mfgExpDate)}) — ถ้าแก้วันหมดอายุ ข้อมูลการแกะซองจะถูกล้าง</div>` : ''}
            <label class="field"><span>เภสัชกรผู้ตรวจสอบ</span><input class="input" name="verifiedBy" value="${esc(S.me.displayName || S.me.username)}" list="verifier-list"><datalist id="verifier-list">${[...new Set(S.items.map(i => i.verifiedBy).filter(Boolean))].map(n => `<option value="${esc(n)}">`).join('')}</datalist></label>
            ${it && S.me.isPharm ? `<label class="field"><span>ย้ายไปกล่อง</span><select class="select input" name="boxId">${S.boxes.map(x => `<option value="${x.id}"${x.id === b.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : ''}
        </form>
        <div class="drawer-foot">
            ${!it ? `<button class="btn" id="fi-save-next" type="button">บันทึกและเพิ่มต่อ</button>` : ''}
            <button class="btn primary" id="fi-save" type="button">บันทึก</button>
        </div>`);
    const ts = new TomSelect('#fi-drug', {
        create: S.me.isPharm ? input => ({ value: 'new:' + input, text: input + ' (เพิ่มยาใหม่เข้าทะเบียน)' }) : false,
        maxOptions: 200, sortField: { field: 'text', direction: 'asc' },
        render: { no_results: () => `<div class="no-results">ไม่พบยานี้ในทะเบียน${S.me.isPharm ? '' : ' — ติดต่อเภสัชกร'}</div>`, option_create: d => `<div class="create">เพิ่ม <b>${esc(d.input)}</b> เป็นยาใหม่</div>` },
        onChange: v => {
            const d = byId(S.drugs, v);
            $('#fi-unit').textContent = d?.unit ? `(${d.unit})` : '';
            $('#fi-cond').textContent = d?.specialCondition || '';
        },
    });
    UI.ts.push(ts);
    if (it) ts.setValue(String(it.drugId)); else setTimeout(() => ts.focus(), 60);
    const f = $('#f-item');
    const syncExpHint = () => { $('#fi-exp-hint').textContent = f.storageLoc.value.includes('ชั้นเก็บยา') ? 'ยาบนชั้นเก็บยาไม่บังคับวันหมดอายุ' : ''; };
    f.storageLoc.onchange = syncExpHint; syncExpHint();
    const save = async (next, btn) => {
        const val = ts.getValue();
        const data = { id: it?.id, boxId: Number(f.boxId?.value || b.id), lotNumber: f.lotNumber.value, qty: f.qty.value, storageLoc: f.storageLoc.value, expireDate: f.expireDate.value, verifiedBy: f.verifiedBy.value };
        if (!val) return Swal.fire({ icon: 'warning', text: 'กรุณาเลือกชื่อยา', confirmButtonText: 'ตกลง' });
        if (String(val).startsWith('new:')) data.drugName = val.slice(4); else data.drugId = Number(val);
        if (!data.expireDate && !data.storageLoc.includes('ชั้นเก็บยา')) return Swal.fire({ icon: 'warning', text: 'ยาในกล่อง/ตู้เย็น จำเป็นต้องระบุวันหมดอายุ', confirmButtonText: 'ตกลง' });
        await withBusy(btn, async () => {
            const r = await api('item_save', data);
            upsertItem(r.item); upsertBoxes(r.boxes);
            if (data.drugName) await refreshLogs(); else refreshLogs();
            toast(r.message);
            if (next) { closeDrawer(); rerender(); openItemDrawer(b.id); } else { closeDrawer(); rerender(); }
        });
    };
    $('#fi-save').onclick = e => save(false, e.currentTarget);
    if ($('#fi-save-next')) $('#fi-save-next').onclick = e => save(true, e.currentTarget);
    f.onsubmit = e => { e.preventDefault(); save(false, $('#fi-save')); };
}
window.openItemDrawer = openItemDrawer;

/* =====================================================================
   รายการยา (ทั้งหมด / หมดอายุ / ใกล้หมดอายุ)
   ===================================================================== */
const LIST_TITLE = { all: 'รายการยาทั้งหมดในระบบ', expired: 'รายการยาที่หมดอายุแล้ว (สีดำ)', exp3m: 'รายการยาที่หมดอายุภายใน 3 เดือน (สีแดง)', exp6m: 'รายการยาที่หมดอายุภายใน 3-6 เดือน (สีส้ม)' };
function listData(type, params) {
    const q = norm(params.get('q') || UI.listFilter.q || '');
    const dept = UI.listFilter.dept || 'all';
    const within = Number(params.get('within')) || null;
    return S.items.filter(it => {
        if (type !== 'all' && it.expStatus !== type) return false;
        if (within && (it.daysLeft === null || it.daysLeft > within)) return false;
        const b = byId(S.boxes, it.boxId);
        if (dept !== 'all' && b.departmentId !== Number(dept)) return false;
        if (q) { const d = drugOf(it); if (!(norm(it.drugName).includes(q) || norm(it.lotNumber).includes(q) || norm(b.name).includes(q) || (d && d.aliases.some(a => norm(a).includes(q))))) return false; }
        return true;
    });
}
function viewList(type, params) {
    const v = $('#view');
    if (params.get('q')) UI.listFilter.q = params.get('q');
    const within = Number(params.get('within')) || null;
    const counts = { all: S.items.length, expired: 0, exp3m: 0, exp6m: 0 };
    S.items.forEach(i => { if (counts[i.expStatus] !== undefined) counts[i.expStatus]++; });
    if (!UI.sort.list) UI.sort.list = { col: 'expireDate', asc: true };
    const rows = sortRows(listData(type, params), UI.sort.list.col, UI.sort.list.asc);
    const title = LIST_TITLE[type] + (within ? ` — ภายใน ${within} วัน` : '');
    v.innerHTML = `
        <div class="page-head"><div><h1>รายการยา</h1><p>${esc(title)} · ${rows.length} รายการ</p></div>
            <div class="actions"><button class="btn" id="l-csv"><i class="fas fa-file-csv"></i> Export</button><button class="btn" id="l-print"><i class="fas fa-print"></i> Print</button></div></div>
        <div class="filters">
            <div class="seg" role="group">${['all', 'expired', 'exp3m', 'exp6m'].map(k => `<button data-t="${k}" class="${k === type ? 'on' : ''}">${{ all: 'ทั้งหมด', expired: 'หมดอายุ', exp3m: '< 3 เดือน', exp6m: '3-6 เดือน' }[k]} (${counts[k]})</button>`).join('')}</div>
            <select class="select" id="l-dept"><option value="all">ทุกหน่วยงาน</option>${S.departments.filter(d => S.boxes.some(b => b.departmentId === d.id)).map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select>
            <input class="input" id="l-q" type="search" placeholder="กรองชื่อยา / Lot / กล่อง" value="${esc(UI.listFilter.q || '')}">
        </div>
        <div class="panel"><div class="tbl-wrap"><table class="tbl cards">
            <thead><tr>${th('department', 'ตึก / กล่อง', 'list')}${th('drugName', 'ชื่อยา', 'list')}<th>Lot</th>${th('expireDate', 'วันหมดอายุ', 'list')}${th('qty', 'จำนวน', 'list', 'num')}<th>แหล่งเก็บ</th><th></th></tr></thead>
            <tbody>${rows.length ? rows.map(it => {
                const b = byId(S.boxes, it.boxId); const ed = canEdit(b);
                return `<tr data-id="${it.id}"><td>${deptBadge(b.departmentId)} <a href="#/box/${b.id}?hl=${it.id}" style="font-size:14px">${esc(b.name)}</a></td>
                    <td class="drug"><b>${esc(it.drugName)}</b></td><td data-l="Lot">${esc(it.lotNumber || '-')}</td>
                    <td data-l="หมดอายุ">${expChip(it)} <small class="faint nowrap">${daysText(it.daysLeft)}</small></td>
                    <td data-l="จำนวน" class="num"><b>${it.qty ?? '-'}</b> <small class="faint">${esc(it.unit || '')}</small></td>
                    <td data-l="แหล่งเก็บ"><span class="tag">${esc(it.storageLoc)}</span></td>
                    <td class="acts">${ed ? `${it.canOpenPkg ? `<button class="btn sm" data-a="open" title="แกะซอง"><i class="fas fa-scissors"></i></button>` : ''}<button class="btn sm" data-a="edit" title="แก้ไข"><i class="fas fa-pen"></i></button><button class="btn sm danger" data-a="del" title="ลบ"><i class="fas fa-trash"></i></button>` : ''}</td></tr>`;
            }).join('') : `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-circle-check" style="color:var(--green)"></i>ไม่มีรายการในกลุ่มนี้</div></td></tr>`}</tbody>
        </table></div></div>`;
    $$('.seg button', v).forEach(b => b.onclick = () => location.hash = `#/list/${b.dataset.t}`);
    $('#l-dept').value = UI.listFilter.dept || 'all';
    $('#l-dept').onchange = e => { UI.listFilter.dept = e.target.value; viewList(type, params); };
    $('#l-q').oninput = debounce(e => { UI.listFilter.q = e.target.value; params.delete('q'); viewList(type, params); $('#l-q').focus(); const l = $('#l-q'); l.setSelectionRange(l.value.length, l.value.length); }, 250);
    bindSort(v, 'list', () => viewList(type, params));
    bindItemActions(v);
    $('#l-csv').onclick = () => exportItemsCsv(rows, 'รายงาน');
    $('#l-print').onclick = () => printListReport(rows, title);
}

/* =====================================================================
   ปฏิทินวันหมดอายุ
   ===================================================================== */
function viewCalendar(v) {
    const now = new Date();
    if (UI.calMonth === null) { UI.calMonth = now.getMonth(); UI.calYear = now.getFullYear(); }
    const m = UI.calMonth, y = UI.calYear;
    const monthItems = S.items.filter(it => { const d = parseYmd(it.expireDate); return d && d.getMonth() === m && d.getFullYear() === y; });
    const first = new Date(y, m, 1).getDay(), dim = new Date(y, m + 1, 0).getDate();
    let cells = '';
    for (let i = 0; i < first; i++) cells += `<div class="day out"></div>`;
    for (let d = 1; d <= dim; d++) {
        const its = monthItems.filter(it => parseYmd(it.expireDate).getDate() === d);
        const isToday = d === now.getDate() && m === now.getMonth() && y === now.getFullYear();
        cells += `<div class="day${isToday ? ' today' : ''}"><span class="d">${d}</span>${its.slice(0, 4).map(it => `<button class="ev ${it.expStatus}" data-id="${it.id}" title="${esc(it.drugName)} — ${esc(byId(S.boxes, it.boxId)?.name)}">${esc(it.drugName)} (${esc(shortDept(byId(S.boxes, it.boxId)?.departmentId))})</button>`).join('')}${its.length > 4 ? `<button class="more" data-day="${d}">+ อีก ${its.length - 4} รายการ</button>` : ''}</div>`;
    }
    const years = []; for (let yy = now.getFullYear() - 1; yy <= now.getFullYear() + 5; yy++) years.push(yy);
    v.innerHTML = `
        <div class="page-head"><div><h1>ปฏิทินวันหมดอายุ</h1><p>${monthItems.length} รายการหมดอายุในเดือนนี้</p></div>
            <div class="actions"><button class="btn" id="c-csv"><i class="fas fa-file-csv"></i> Export เดือนนี้</button><button class="btn" id="c-print"><i class="fas fa-print"></i> Print แนวนอน</button></div></div>
        <div class="cal-controls">
            <button class="btn icon" id="c-prev" aria-label="เดือนก่อน"><i class="fas fa-chevron-left"></i></button>
            <h2>${THAI_MONTHS[m]} ${y + 543}</h2>
            <button class="btn icon" id="c-next" aria-label="เดือนถัดไป"><i class="fas fa-chevron-right"></i></button>
            <select class="select input" id="c-m" style="width:auto">${THAI_MONTHS.map((t, i) => `<option value="${i}"${i === m ? ' selected' : ''}>${t}</option>`).join('')}</select>
            <select class="select input" id="c-y" style="width:auto">${years.map(yy => `<option value="${yy}"${yy === y ? ' selected' : ''}>${yy + 543}</option>`).join('')}</select>
            <button class="btn ghost" id="c-today">เดือนนี้</button>
            <div class="legend" style="margin-left:auto"><span><i style="background:${ST_COLOR.expired}"></i>หมดอายุแล้ว</span><span><i style="background:${ST_COLOR.exp3m}"></i>&lt; 3 เดือน</span><span><i style="background:${ST_COLOR.exp6m}"></i>3-6 เดือน</span><span><i style="background:${ST_COLOR.ok}"></i>ปกติ</span></div>
        </div>
        <div class="cal">${['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map(d => `<div class="dow">${d}</div>`).join('')}${cells}</div>`;
    const set = (mm, yy) => { UI.calMonth = (mm + 12) % 12; UI.calYear = yy + (mm < 0 ? -1 : mm > 11 ? 1 : 0); viewCalendar(v); };
    $('#c-prev').onclick = () => set(m - 1, y); $('#c-next').onclick = () => set(m + 1, y);
    $('#c-m').onchange = e => set(+e.target.value, y); $('#c-y').onchange = e => set(m, +e.target.value);
    $('#c-today').onclick = () => set(now.getMonth(), now.getFullYear());
    $$('.ev', v).forEach(e => e.onclick = () => { const it = byId(S.items, e.dataset.id); location.hash = `#/box/${it.boxId}?hl=${it.id}`; });
    $$('.more', v).forEach(e => e.onclick = () => {
        const its = monthItems.filter(it => parseYmd(it.expireDate).getDate() === +e.dataset.day);
        Swal.fire({ title: `${e.dataset.day} ${THAI_MONTHS[m]} ${y + 543}`, html: `<div style="text-align:left">${its.map(it => `<p style="margin:6px 0"><span class="exp ${it.expStatus}">${esc(it.drugName)}</span><br><small>${esc(byId(S.boxes, it.boxId)?.name)} · Lot ${esc(it.lotNumber || '-')}</small></p>`).join('')}</div>`, confirmButtonText: 'ปิด' });
    });
    $('#c-csv').onclick = () => exportItemsCsv(monthItems, 'รายงาน');
    $('#c-print').onclick = () => printCalendar(m, y, monthItems);
}

/* =====================================================================
   รายงานวิเคราะห์
   ===================================================================== */
function viewReports(v) {
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const today = new Date();
    if (!UI.logRange) UI.logRange = { start: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), end: ymd(today) };
    const af = UI.anl || (UI.anl = { ward: 'all', type: 'all', drug: 'all' });
    v.innerHTML = `
        <div class="page-head"><div><h1>รายงานวิเคราะห์</h1><p>ข้อมูลคลังยาในกล่องทุกหอผู้ป่วย</p></div></div>
        <div class="charts">
            <div class="panel"><div class="panel-head"><h2>สัดส่วนสถานะวันหมดอายุ</h2></div><div class="panel-body"><div class="chart-box"><canvas id="ch-status"></canvas></div></div></div>
            <div class="panel"><div class="panel-head"><h2>ยาที่มีความเสี่ยง แยกตามหอผู้ป่วย</h2></div><div class="panel-body"><div class="chart-box"><canvas id="ch-ward"></canvas></div></div></div>
        </div>

        <div class="panel section" id="sec-expiry">
            <div class="panel-head"><h2>สรุปรายการยาที่หมดอายุ และใกล้หมดอายุ (เพื่อการจัดซื้อ)</h2>
                <div class="actions"><button class="btn sm" data-csv="t-expiry" data-name="สรุปยาใกล้หมดอายุ"><i class="fas fa-file-csv"></i> Excel</button><button class="btn sm" data-print="t-expiry"><i class="fas fa-print"></i> Print</button></div></div>
            <div class="tbl-wrap"><table class="tbl" id="t-expiry"></table></div>
        </div>

        <div class="panel section" id="sec-master">
            <div class="panel-head"><h2>ทะเบียนรายการยาทั้งระบบ (Inventory Master)</h2>
                <div class="actions"><button class="btn sm" data-csv="t-master" data-name="ทะเบียนยาทั้งระบบ"><i class="fas fa-file-csv"></i> Excel</button><button class="btn sm" data-print="t-master"><i class="fas fa-print"></i> Print</button></div></div>
            <div class="panel-body" style="padding-bottom:0">
                <div class="filters">
                    <select class="select" id="a-ward"><option value="all">ทุกหอผู้ป่วย</option>${S.departments.filter(d => S.boxes.some(b => b.departmentId === d.id)).map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select>
                    <select class="select" id="a-type"><option value="all">ทุกประเภทกล่อง</option>${S.boxTypes.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>
                    <select class="select" id="a-drug"><option value="all">ทุกรายการยา</option>${S.drugs.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select>
                </div>
                <p id="a-sum" style="margin:0 0 10px;font-weight:500"></p>
            </div>
            <div class="tbl-wrap"><table class="tbl" id="t-master"></table></div>
        </div>

        <div class="panel section" id="sec-logs">
            <div class="panel-head"><h2>สถิติการอัปเดต และเคลื่อนไหวรายการยา</h2>
                <div class="actions"><button class="btn sm" data-csv="t-logs" data-name="สถิติการอัพเดตยา"><i class="fas fa-file-csv"></i> Excel</button><button class="btn sm" data-print="t-logs"><i class="fas fa-print"></i> Print</button></div></div>
            <div class="panel-body" style="padding-bottom:0"><div class="filters">
                <label>ตั้งแต่ <input class="input" type="date" id="lg-s" value="${UI.logRange.start}" style="width:auto"></label>
                <label>ถึง <input class="input" type="date" id="lg-e" value="${UI.logRange.end}" style="width:auto"></label>
                <button class="btn ghost" id="lg-month"><i class="fas fa-rotate-left"></i> เดือนนี้</button></div></div>
            <div class="tbl-wrap"><table class="tbl" id="t-logs"><tbody><tr><td><div class="sk" style="height:80px"></div></td></tr></tbody></table></div>
        </div>`;

    drawCharts();
    drawExpiryTable();
    const drawMaster = () => {
        let rows = S.items.filter(it => { const b = byId(S.boxes, it.boxId); return (af.ward === 'all' || b.departmentId === +af.ward) && (af.type === 'all' || b.boxTypeId === +af.type) && (af.drug === 'all' || it.drugId === +af.drug); });
        const s = UI.sort.master || (UI.sort.master = { col: 'drugName', asc: true });
        rows = sortRows(rows, s.col, s.asc);
        $('#a-sum').innerHTML = `รวมทั้งสิ้น <span style="color:var(--green)">${rows.length}</span> รายการ · จำนวนชิ้นรวม <span style="color:#2980b9">${rows.reduce((a, r) => a + (r.qty || 0), 0)}</span> ชิ้น`;
        $('#t-master').innerHTML = `<thead><tr>${th('department', 'หอผู้ป่วย', 'master')}${th('boxName', 'กล่อง', 'master')}${th('drugName', 'ชื่อยา', 'master')}<th>Lot Number</th>${th('expireDate', 'วันหมดอายุ', 'master')}<th class="num">จำนวน</th></tr></thead><tbody>${rows.map(it => {
            const b = byId(S.boxes, it.boxId);
            return `<tr><td>${deptBadge(b.departmentId)}</td><td>${esc(b.name)}</td><td><b>${esc(it.drugName)}</b></td><td>${esc(it.lotNumber || '-')}</td><td data-csv="${esc(it.expireDate || '')}">${expChip(it)}</td><td class="num">${it.qty ?? '-'}</td></tr>`;
        }).join('') || '<tr><td colspan="6"><div class="empty-state">ไม่พบข้อมูลตามเงื่อนไข</div></td></tr>'}</tbody>`;
        bindSort($('#sec-master'), 'master', drawMaster);
    };
    $('#a-ward').value = af.ward; $('#a-type').value = af.type; $('#a-drug').value = af.drug;
    $('#a-ward').onchange = e => { af.ward = e.target.value; drawMaster(); };
    $('#a-type').onchange = e => { af.type = e.target.value; drawMaster(); };
    const tsd = new TomSelect('#a-drug', { maxOptions: 300, onChange: val => { af.drug = val || 'all'; drawMaster(); } });
    UI.charts.push({ destroy: () => tsd.destroy() });
    drawMaster();

    const loadLogs = async () => {
        UI.logRange = { start: $('#lg-s').value, end: $('#lg-e').value };
        try {
            const r = await api('logs', UI.logRange);
            $('#t-logs').innerHTML = `<thead><tr><th>วัน-เวลา</th><th>ประเภท</th><th>รายละเอียดการเปลี่ยนแปลง</th><th>ผู้ดำเนินการ</th></tr></thead><tbody>${r.logs.map(l => `<tr><td class="nowrap" data-csv="${esc(l.timestamp)}">${thDateTime(l.timestamp)}</td><td data-csv="${esc(l.action)}"><span class="act" style="background:${ACT_COLOR[l.action] || '#7f8c8d'}">${esc(ACT_LABEL[l.action] || l.action)}</span></td><td>${esc(l.details)}</td><td>${esc(l.user || '-')}</td></tr>`).join('') || '<tr><td colspan="4"><div class="empty-state">ไม่มีการเคลื่อนไหวในช่วงเวลานี้</div></td></tr>'}</tbody>`;
        } catch { $('#t-logs').innerHTML = '<tbody><tr><td><div class="empty-state">โหลดประวัติไม่สำเร็จ</div></td></tr></tbody>'; }
    };
    $('#lg-s').onchange = loadLogs; $('#lg-e').onchange = loadLogs;
    $('#lg-month').onclick = () => { $('#lg-s').value = ymd(new Date(today.getFullYear(), today.getMonth(), 1)); $('#lg-e').value = ymd(today); loadLogs(); };
    loadLogs();

    $$('[data-csv]', v).filter(b => b.tagName === 'BUTTON').forEach(b => b.onclick = () => exportTableCsv(b.dataset.csv, b.dataset.name));
    $$('[data-print]', v).forEach(b => b.onclick = () => printSection(b.dataset.print, b.closest('.panel').querySelector('h2').textContent));
    if (params.get('tab') === 'logs') setTimeout(() => $('#sec-logs').scrollIntoView({ behavior: 'smooth' }), 100);
}
function drawCharts() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.font.family = "'IBM Plex Sans Thai', sans-serif";
    const c = { ok: 0, exp6m: 0, exp3m: 0, expired: 0 };
    S.items.forEach(i => { if (c[i.expStatus] !== undefined) c[i.expStatus]++; });
    UI.charts.push(new Chart($('#ch-status'), {
        type: 'doughnut',
        data: { labels: ['ปกติ', 'หมดอายุ 3-6 เดือน', 'หมดอายุ < 3 เดือน', 'หมดอายุแล้ว'], datasets: [{ data: [c.ok, c.exp6m, c.exp3m, c.expired], backgroundColor: [ST_COLOR.ok, ST_COLOR.exp6m, ST_COLOR.exp3m, ST_COLOR.expired], borderWidth: 2, borderColor: '#fff' }] },
        options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right' } } },
    }));
    const depts = S.departments.filter(d => S.boxes.some(b => b.departmentId === d.id));
    const cnt = st => depts.map(d => S.items.filter(i => i.expStatus === st && byId(S.boxes, i.boxId).departmentId === d.id).length);
    UI.charts.push(new Chart($('#ch-ward'), {
        type: 'bar',
        data: { labels: depts.map(d => d.short), datasets: [
            { label: 'หมดอายุแล้ว', data: cnt('expired'), backgroundColor: ST_COLOR.expired, borderRadius: 3 },
            { label: '< 3 เดือน', data: cnt('exp3m'), backgroundColor: ST_COLOR.exp3m, borderRadius: 3 },
            { label: '3-6 เดือน', data: cnt('exp6m'), backgroundColor: ST_COLOR.exp6m, borderRadius: 3 }] },
        options: { maintainAspectRatio: false, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { position: 'bottom' } } },
    }));
}
function drawExpiryTable() {
    const totalByDrug = {};
    S.items.forEach(i => { totalByDrug[i.drugId] = (totalByDrug[i.drugId] || 0) + (i.qty || 0); });
    const g = {};
    S.items.filter(i => ['expired', 'exp3m', 'exp6m'].includes(i.expStatus)).forEach(i => {
        const k = i.drugId + '|' + i.expireDate;
        (g[k] = g[k] || { drugId: i.drugId, drugName: i.drugName, expireDate: i.expireDate, expStatus: i.expStatus, qty: 0, boxes: [] }).qty += i.qty || 0;
        g[k].boxes.push(byId(S.boxes, i.boxId).name);
    });
    const rows = Object.values(g).sort((a, b) => a.expireDate < b.expireDate ? -1 : 1);
    $('#t-expiry').innerHTML = `<thead><tr><th>ชื่อยา</th><th>วันหมดอายุ (ของ Lot นี้)</th><th>สถานะความเสี่ยง</th><th class="num">จำนวนใน Lot นี้</th><th class="num" style="color:#B86E00">จำนวนรวมที่มีทั้ง รพ.</th></tr></thead><tbody>${rows.map(r => `
        <tr><td><b>${esc(r.drugName)}</b><br><small class="faint" data-noexport>${esc(r.boxes.join(', '))}</small></td><td data-csv="${esc(r.expireDate)}">${thDate(r.expireDate)}</td>
        <td><span class="exp ${r.expStatus}">${{ expired: 'หมดอายุแล้ว', exp3m: '< 3 เดือน', exp6m: '3-6 เดือน' }[r.expStatus]}</span></td><td class="num">${r.qty}</td><td class="num" style="color:#B86E00;font-weight:700">${totalByDrug[r.drugId]}</td></tr>`).join('')
        || '<tr><td colspan="5"><div class="empty-state">ไม่มีรายการยาที่เข้าข่าย</div></td></tr>'}</tbody>`;
}

/* =====================================================================
   คู่มือบริหารยา
   ===================================================================== */
function viewManual(drugId) {
    const v = $('#view');
    const withDoc = S.drugs.filter(d => d.prep || d.admin || d.precautions);
    v.innerHTML = `
        <div class="page-head"><div><h1>คู่มือบริหารยา</h1><p>ข้อมูลการเตรียมยา การบริหารยา และข้อควรระวัง</p></div>
            ${S.me.isPharm ? `<div class="actions"><a class="btn" href="#/settings/drugs"><i class="fas fa-pen"></i> แก้ไขคู่มือในทะเบียนยา</a></div>` : ''}</div>
        <div class="panel section"><div class="panel-body"><div class="field" style="margin:0"><span>ค้นหารายชื่อยา</span><select id="m-drug" placeholder="พิมพ์ชื่อยาเพื่อค้นหา" aria-label="ค้นหารายชื่อยา"><option value=""></option>${S.drugs.filter(d => d.isActive).map(d => `<option value="${d.id}">${esc(d.name)}${d.prep || d.admin ? '' : ' (ยังไม่มีคู่มือ)'}</option>`).join('')}</select></div>
            ${withDoc.length ? `<p class="muted" style="margin:12px 0 0;font-size:14px">มีคู่มือแล้ว: ${withDoc.map(d => `<a href="#/manual/${d.id}">${esc(d.name)}</a>`).join(', ')}</p>` : ''}</div></div>
        <div id="m-doc"></div>`;
    const show = id => {
        const d = byId(S.drugs, id);
        if (!d) { $('#m-doc').innerHTML = ''; return; }
        const none = '<span class="faint"><i>ไม่มีข้อมูล</i></span>';
        $('#m-doc').innerHTML = `<div class="panel"><div class="panel-body drug-doc">
            <div><h2>${esc(d.name)}</h2><p class="muted" style="margin:4px 0 0"><b>หน่วยนับ:</b> ${esc(d.unit || '-')}${d.specialCondition ? ` · <b>เงื่อนไขพิเศษ:</b> ${esc(d.specialCondition)}` : ''}</p></div>
            <div class="doc-block prep"><h3><i class="fas fa-vial"></i> การเตรียมยา</h3><div class="txt">${safeHtml(d.prep) || none}</div></div>
            <div class="doc-block admin"><h3><i class="fas fa-syringe"></i> การบริหารยา</h3><div class="txt">${safeHtml(d.admin) || none}</div></div>
            <div class="doc-block prec"><h3><i class="fas fa-triangle-exclamation"></i> ข้อควรระวัง</h3><div class="txt">${safeHtml(d.precautions) || none}</div></div>
        </div></div>`;
    };
    const ts = new TomSelect('#m-drug', { maxOptions: 300, onChange: val => { history.replaceState(null, '', val ? `#/manual/${val}` : '#/manual'); show(val); } });
    UI.charts.push({ destroy: () => ts.destroy() });
    if (drugId) { ts.setValue(String(drugId), true); show(drugId); }
}

/* =====================================================================
   เมนูเพิ่มเติม (มือถือ)
   ===================================================================== */
function viewMore(v) {
    v.innerHTML = `<div class="page-head"><div><h1>เมนู</h1><p>${esc(S.me.displayName)} · ${esc(roleName(S.me.role))}</p></div></div>
        <div class="panel"><ul class="timeline" style="padding:6px 16px">${NAV.slice(3).map(n => `<li style="grid-template-columns:28px 1fr"><i class="fas ${n.i}" style="color:var(--pine)"></i><a href="#/${n.r}" style="text-decoration:none;color:var(--ink);font-weight:500">${n.t}</a></li>`).join('')}
        <li style="grid-template-columns:28px 1fr"><i class="fas fa-right-from-bracket" style="color:var(--st-exp3m)"></i><a href="javascript:void 0" id="more-logout" style="text-decoration:none;color:var(--st-exp3m);font-weight:500">ออกจากระบบ</a></li></ul></div>`;
    $('#more-logout').onclick = logout;
}

/* =====================================================================
   ตั้งค่า
   ===================================================================== */
function viewSettings(tab) {
    const v = $('#view');
    const tabs = [['profile', 'ข้อมูลของฉัน', true], ['drugs', 'ทะเบียนยา', S.me.isPharm], ['boxes', 'กล่องยา', S.me.isAdmin], ['users', 'ผู้ใช้งาน', S.me.isAdmin], ['line', 'แจ้งเตือน LINE', S.me.isPharm]].filter(t => t[2]);
    if (!tabs.some(t => t[0] === tab)) tab = 'profile';
    v.innerHTML = `<div class="page-head"><div><h1>ตั้งค่า</h1></div></div>
        <nav class="tabs">${tabs.map(t => `<a href="#/settings/${t[0]}" class="${t[0] === tab ? 'on' : ''}">${t[1]}</a>`).join('')}</nav><div id="st-body"></div>`;
    ({ profile: setProfile, drugs: setDrugs, boxes: setBoxes, users: setUsers, line: setLine })[tab]($('#st-body'));
}
function setProfile(el) {
    el.innerHTML = `<div class="panel" style="max-width:560px"><form class="panel-body" id="f-prof">
        <label class="field"><span>Username</span><input class="input" value="${esc(S.me.username)}" disabled></label>
        <label class="field"><span>ชื่อที่ใช้แสดง (เติมในช่องผู้ตรวจสอบอัตโนมัติ)</span><input class="input" name="displayName" value="${esc(S.me.displayName)}" required></label>
        <label class="field"><span>E-mail (ใช้รับรหัสเมื่อลืมรหัสผ่าน)</span><input class="input" type="email" name="email" value="${esc(S.me.email || '')}"></label>
        <label class="field"><span>หน่วยงาน / สิทธิ์</span><input class="input" value="${esc(S.me.department || '-')} / ${esc(roleName(S.me.role))}" disabled></label>
        <h3 style="font-size:16px;margin:20px 0 10px">เปลี่ยนรหัสผ่าน <small class="faint">(เว้นว่างถ้าไม่เปลี่ยน)</small></h3>
        <div class="row"><label class="field"><span>รหัสผ่านเดิม</span><input class="input" type="password" name="oldPassword" autocomplete="current-password"></label>
        <label class="field"><span>รหัสผ่านใหม่</span><input class="input" type="password" name="newPassword" minlength="6" autocomplete="new-password"></label></div>
        <button class="btn primary" type="submit">บันทึกข้อมูล</button></form></div>`;
    $('#f-prof').onsubmit = async e => {
        e.preventDefault();
        await withBusy(e.submitter, async () => { const r = await api('profile_save', Object.fromEntries(new FormData(e.target))); S.me = r.me; renderChrome(); toast(r.message); e.target.oldPassword.value = e.target.newPassword.value = ''; });
    };
}
function setDrugs(el) {
    const used = {}; S.items.forEach(i => used[i.drugId] = (used[i.drugId] || 0) + 1);
    el.innerHTML = `<div class="toolbar"><input class="input" id="d-q" type="search" placeholder="ค้นหายา" style="max-width:320px"><span class="grow"></span>
        ${S.me.isAdmin ? `<button class="btn" id="d-merge"><i class="fas fa-code-merge"></i> รวมยาที่ชื่อซ้ำ</button>` : ''}<button class="btn primary" id="d-new"><i class="fas fa-plus"></i> เพิ่มยาใหม่</button></div>
        <div class="panel"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>ชื่อยา</th><th>หน่วยนับ</th><th>เงื่อนไขพิเศษ</th><th>อายุหลังแกะซอง</th><th>คู่มือ</th><th class="num">ใช้อยู่</th><th></th></tr></thead><tbody id="d-rows"></tbody></table></div></div>`;
    const draw = () => {
        const q = norm($('#d-q').value);
        $('#d-rows').innerHTML = S.drugs.filter(d => !q || norm(d.name).includes(q) || d.aliases.some(a => norm(a).includes(q))).map(d => `<tr${d.isActive ? '' : ' style="opacity:.5"'}>
            <td><b>${esc(d.name)}</b>${d.aliases.length ? `<br><small class="faint">ชื่ออื่น: ${esc(d.aliases.join(', '))}</small>` : ''}</td><td>${esc(d.unit || '-')}</td><td><small>${esc(d.specialCondition || '')}</small></td>
            <td>${d.openedShelfLifeDays ? d.openedShelfLifeDays + ' วัน' : '-'}</td><td>${d.prep || d.admin ? '<i class="fas fa-check" style="color:var(--green)"></i>' : ''}</td><td class="num">${used[d.id] || 0}</td>
            <td class="acts"><button class="btn sm" data-id="${d.id}"><i class="fas fa-pen"></i> แก้ไข</button></td></tr>`).join('');
        $$('#d-rows [data-id]').forEach(b => b.onclick = () => drugDrawer(byId(S.drugs, b.dataset.id)));
    };
    $('#d-q').oninput = draw; $('#d-new').onclick = () => drugDrawer(null);
    if ($('#d-merge')) $('#d-merge').onclick = mergeDrugs;
    draw();
}
function drugDrawer(d) {
    openDrawer(`<div class="drawer-head"><div><h2>${d ? 'แก้ไขทะเบียนยา' : 'เพิ่มยาใหม่'}</h2><p>ข้อมูลนี้ใช้ทั้งในกล่องยา สติ๊กเกอร์ และคู่มือบริหารยา</p></div><button class="btn icon ghost" data-close aria-label="ปิด"><i class="fas fa-xmark"></i></button></div>
        <form class="drawer-body" id="f-drug">
            <label class="field"><span>ชื่อยา</span><input class="input" name="name" value="${esc(d?.name || '')}" required></label>
            <div class="row"><label class="field"><span>หน่วยนับ</span><input class="input" name="unit" value="${esc(d?.unit || '')}" placeholder="เช่น Amp, เม็ด, ขวด"></label>
            <label class="field"><span>อายุหลังแกะซอง (วัน)</span><input class="input" type="number" min="1" name="openedShelfLifeDays" value="${d?.openedShelfLifeDays ?? ''}" placeholder="เว้นว่างถ้าไม่มี"></label></div>
            <label class="field"><span>เงื่อนไขพิเศษ</span><input class="input" name="specialCondition" value="${esc(d?.specialCondition || '')}" placeholder="เช่น เฉพาะตึกลีลาวดี"></label>
            <div class="hint">ช่องคู่มือรองรับการจัดรูปแบบ เช่น &lt;b&gt;ตัวหนา&lt;/b&gt; และ &lt;span style="color:var(--st-exp3m)"&gt;ตัวแดง&lt;/span&gt;</div>
            <label class="field"><span>การเตรียมยา</span><textarea class="input" name="prep">${esc(d?.prep || '')}</textarea></label>
            <label class="field"><span>การบริหารยา</span><textarea class="input" name="admin">${esc(d?.admin || '')}</textarea></label>
            <label class="field"><span>ข้อควรระวัง</span><textarea class="input" name="precautions">${esc(d?.precautions || '')}</textarea></label>
            <label class="check"><input type="checkbox" name="isActive" ${!d || d.isActive ? 'checked' : ''}> เปิดใช้งาน (ปิดแล้วจะไม่แสดงตอนเลือกยาเข้ากล่อง)</label>
        </form>
        <div class="drawer-foot"><button class="btn" data-close type="button">ยกเลิก</button><button class="btn primary" id="d-save" type="button">บันทึก</button></div>`);
    $('#d-save').onclick = async e => {
        const f = $('#f-drug'); const data = Object.fromEntries(new FormData(f)); data.isActive = f.isActive.checked; data.id = d?.id;
        await withBusy(e.currentTarget, async () => { const r = await api('drug_save', data); await refreshLogs(); S.items.forEach(i => { if (i.drugId === r.drugId) { i.drugName = data.name; i.unit = data.unit; i.canOpenPkg = !!data.openedShelfLifeDays; } }); toast(r.message); closeDrawer(); rerender(); });
    };
}
async function mergeDrugs() {
    const opts = S.drugs.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
    const { value, isConfirmed } = await Swal.fire({
        title: 'รวมยาที่ชื่อซ้ำ', confirmButtonText: 'รวมยา', cancelButtonText: 'ยกเลิก', showCancelButton: true,
        html: `<div style="text-align:left"><p class="muted" style="font-size:14px">ใช้เมื่อยาตัวเดียวกันถูกบันทึกไว้ 2 ชื่อ รายการในกล่องทั้งหมดจะย้ายไปอยู่ที่ชื่อหลัก และชื่อเดิมจะเก็บไว้เป็นชื่อเรียกอื่น</p>
            <label class="field"><span>ชื่อที่จะเลิกใช้</span><select class="select input" id="mg-from">${opts}</select></label>
            <label class="field"><span>รวมเข้ากับชื่อหลัก</span><select class="select input" id="mg-into">${opts}</select></label></div>`,
        preConfirm: () => ({ fromId: +$('#mg-from').value, intoId: +$('#mg-into').value }),
    });
    if (!isConfirmed) return;
    try { const r = await api('drug_merge', value); toast(r.message); const d = await api('bootstrap'); applyBootstrap(d); rerender(); } catch { /* แจ้งแล้ว */ }
}
function setBoxes(el) {
    el.innerHTML = `<div class="toolbar"><span class="grow"></span><button class="btn primary" id="bx-new"><i class="fas fa-plus"></i> เพิ่มกล่องใหม่</button></div>
        <div class="panel"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>หน่วยงาน</th><th>ประเภท</th><th>ชื่อกล่อง</th><th class="num">รายการยา</th><th></th></tr></thead><tbody>${S.boxes.map(b => `<tr><td>${deptBadge(b.departmentId)}</td><td>${esc(byId(S.boxTypes, b.boxTypeId)?.name)}</td><td><b>${esc(b.name)}</b></td><td class="num">${b.itemCount}</td><td class="acts"><button class="btn sm" data-id="${b.id}"><i class="fas fa-pen"></i> แก้ไข</button></td></tr>`).join('')}</tbody></table></div></div>`;
    const drawer = b => {
        openDrawer(`<div class="drawer-head"><div><h2>${b ? 'แก้ไขกล่องยา' : 'เพิ่มกล่องยาใหม่'}</h2><p>เปลี่ยนชื่อกล่องได้ โดยรายการยาในกล่องไม่หลุด</p></div><button class="btn icon ghost" data-close aria-label="ปิด"><i class="fas fa-xmark"></i></button></div>
            <form class="drawer-body" id="f-box">
                <label class="field"><span>ชื่อกล่อง</span><input class="input" name="name" value="${esc(b?.name || '')}" required></label>
                <label class="field"><span>หน่วยงาน</span><select class="select input" name="departmentId">${S.departments.map(d => `<option value="${d.id}"${b?.departmentId === d.id ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</select></label>
                <label class="field"><span>ประเภทกล่อง</span><select class="select input" name="boxTypeId">${S.boxTypes.map(t => `<option value="${t.id}"${b?.boxTypeId === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
                ${b ? `<label class="check"><input type="checkbox" name="isActive" checked> เปิดใช้งาน (ปิดแล้วกล่องและยาในกล่องจะไม่แสดง)</label>` : ''}
            </form><div class="drawer-foot"><button class="btn" data-close type="button">ยกเลิก</button><button class="btn primary" id="bx-save" type="button">บันทึก</button></div>`);
        $('#bx-save').onclick = async e => {
            const f = $('#f-box'); const data = { id: b?.id, name: f.name.value, departmentId: +f.departmentId.value, boxTypeId: +f.boxTypeId.value, isActive: f.isActive ? f.isActive.checked : true };
            await withBusy(e.currentTarget, async () => { await api('box_save', data); applyBootstrap(await api('bootstrap')); toast('บันทึกกล่องยาเรียบร้อย'); closeDrawer(); rerender(); });
        };
    };
    $('#bx-new').onclick = () => drawer(null);
    $$('[data-id]', el).forEach(x => x.onclick = () => drawer(byId(S.boxes, x.dataset.id)));
}
async function setUsers(el) {
    el.innerHTML = '<div class="sk" style="height:240px"></div>';
    let users;
    try { users = (await api('user_list')).users; } catch { el.innerHTML = ''; return; }
    const roles = ['Admin', 'Pharmacist', 'User'];
    const stName = { active: 'ใช้งาน', pending: 'รออนุมัติ', disabled: 'ระงับ' };
    el.innerHTML = `<div class="panel"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>ผู้ใช้</th><th>หน่วยงาน</th><th>สิทธิ์</th><th>สถานะ</th><th>เข้าใช้ล่าสุด</th><th></th></tr></thead><tbody>${users.map(u => `
        <tr data-uid="${u.id}"><td><b>${esc(u.displayName)}</b><br><small class="faint">${esc(u.username)} · ${esc(u.email || '-')}</small></td>
        <td><select class="select input" data-f="departmentId" style="min-width:160px"><option value="">-</option>${S.departments.map(d => `<option value="${d.id}"${u.departmentId === d.id ? ' selected' : ''}>${esc(d.short)}</option>`).join('')}</select></td>
        <td><select class="select input" data-f="role">${(roles.includes(u.role) ? roles : [u.role, ...roles]).map(r => `<option value="${r}"${u.role === r ? ' selected' : ''}>${esc(roleName(r))}${r === 'Pharmacist' ? '' : ''}</option>`).join('')}</select></td>
        <td><select class="select input" data-f="status">${Object.entries(stName).map(([k, t]) => `<option value="${k}"${u.status === k ? ' selected' : ''}>${t}</option>`).join('')}</select>${u.status === 'pending' ? ' <span class="tag warn">ใหม่</span>' : ''}</td>
        <td><small>${u.lastLoginAt ? thDateTime(u.lastLoginAt) : '-'}</small></td>
        <td class="acts"><button class="btn sm primary" data-save>บันทึก</button> <button class="btn sm" data-reset title="รีเซ็ตรหัสผ่าน"><i class="fas fa-key"></i></button></td></tr>`).join('')}</tbody></table></div></div>
        <p class="muted" style="font-size:14px;margin-top:12px"><b>ผู้ใช้งานหอผู้ป่วย</b> แก้ไขได้เฉพาะกล่องของหน่วยงานตัวเอง · <b>เภสัชกร</b> แก้ไขได้ทุกกล่องและเคลียร์สถานะ · <b>ผู้ดูแลระบบ</b> จัดการผู้ใช้ กล่อง และทะเบียนยา</p>`;
    $$('tr[data-uid]', el).forEach(tr => {
        const u = users.find(x => x.id === +tr.dataset.uid);
        $('[data-save]', tr).onclick = e => withBusy(e.currentTarget, async () => {
            const data = { id: u.id, displayName: u.displayName, email: u.email };
            $$('[data-f]', tr).forEach(s => data[s.dataset.f] = s.value);
            const r = await api('user_save', data); toast(r.message);
        });
        $('[data-reset]', tr).onclick = async e => {
            const ok = await Swal.fire({ icon: 'question', title: `รีเซ็ตรหัสผ่าน ${u.username}?`, text: 'ระบบจะสร้างรหัสผ่านชั่วคราวให้ แจ้งผู้ใช้แล้วให้เปลี่ยนในหน้า "ข้อมูลของฉัน"', showCancelButton: true, confirmButtonText: 'รีเซ็ต', cancelButtonText: 'ยกเลิก' });
            if (!ok.isConfirmed) return;
            await withBusy(e.currentTarget, async () => { const r = await api('user_reset_password', { id: u.id }); Swal.fire({ icon: 'success', title: 'รหัสผ่านชั่วคราว', html: `<p>แจ้ง <b>${esc(u.username)}</b> ให้ใช้รหัสนี้เข้าสู่ระบบ</p><p style="font-size:24px;font-weight:700;letter-spacing:.06em;user-select:all">${esc(r.tempPassword)}</p><small class="muted">รหัสนี้จะแสดงครั้งเดียว</small>`, confirmButtonText: 'ปิด' }); });
        };
    });
}
function setLine(el) {
    el.innerHTML = `<div class="panel" style="max-width:720px"><div class="panel-body">
        <p>ระบบส่งแจ้งเตือนทาง LINE Official Account เมื่อ</p>
        <ul style="margin:0 0 16px;padding-left:20px;line-height:1.9"><li>มีผู้ลงทะเบียนใหม่ (รออนุมัติ)</li><li>หอผู้ป่วยส่งกล่องให้เภสัชฯ ปรับแก้ และเมื่อเภสัชฯ เคลียร์สถานะ</li><li>มีการยืนยันตรวจกล่อง (Stock Take)</li><li>สรุปยาหมดอายุ/ใกล้หมดอายุประจำวัน (ตั้งเวลาใน Plesk)</li></ul>
        <div class="toolbar"><button class="btn" id="ln-preview"><i class="fas fa-eye"></i> ดูตัวอย่างข้อความสรุปวันนี้</button>
        ${S.me.isAdmin ? `<button class="btn" id="ln-test"><i class="fab fa-line"></i> ส่งข้อความทดสอบ</button><button class="btn" id="ln-send"><i class="fas fa-paper-plane"></i> ส่งสรุปวันนี้ทันที</button>` : ''}</div>
        <pre id="ln-out" style="white-space:pre-wrap;background:var(--line-2);padding:14px;border-radius:8px;font:14px/1.6 var(--font);display:none"></pre></div></div>`;
    const show = t => { const o = $('#ln-out'); o.style.display = 'block'; o.textContent = t; };
    $('#ln-preview').onclick = e => withBusy(e.currentTarget, async () => show((await api('line_preview_summary')).message));
    if ($('#ln-test')) $('#ln-test').onclick = e => withBusy(e.currentTarget, async () => { const r = await api('line_test'); show(r.message); });
    if ($('#ln-send')) $('#ln-send').onclick = e => withBusy(e.currentTarget, async () => { const r = await api('line_preview_summary', { send: true }); show(r.message + '\n\n— ' + (r.sent ? (r.sent.ok ? 'ส่งสำเร็จ' : 'ส่งไม่สำเร็จ: ' + r.sent.response) : 'ไม่ได้ส่ง')); });
}

/* =====================================================================
   พิมพ์ — ป้ายกล่อง & สติ๊กเกอร์ (ตรรกะเดียวกับระบบเดิม)
   ===================================================================== */
function runPrint(bodyClass, pageCss, cleanup) {
    const style = $('#print-page-style');
    style.innerHTML = pageCss || '';
    if (bodyClass) document.body.classList.add(bodyClass);
    let done = false;
    const end = () => { if (done) return; done = true; if (bodyClass) document.body.classList.remove(bodyClass); style.innerHTML = ''; cleanup && cleanup(); };
    window.addEventListener('afterprint', end, { once: true });
    setTimeout(() => { window.print(); setTimeout(end, 1000); }, 50);
}

/* 🏷️ สติ๊กเกอร์แปะซองยา 8.5 x 5.4 cm แบ่ง 2 ช่อง (ซ้าย-ขวา) */
function printStickers(b) {
    const checked = $$('.sticker-checkbox:checked');
    if (!checked.length) return Swal.fire({ icon: 'warning', title: 'โปรดเลือกรายการยา', text: 'กรุณาติ๊กเลือกรายการยาที่ต้องการปริ้นท์สติ๊กเกอร์อย่างน้อย 1 รายการ', confirmButtonText: 'ตกลง' });
    const ids = checked.map(c => Number(c.value));
    const selectedDrugs = itemsOf(b.id).filter(i => ids.includes(i.id)).sort((x, y) => ids.indexOf(x.id) - ids.indexOf(y.id));
    const stickerContainer = $('#sticker-container');
    stickerContainer.innerHTML = '';
    const PER_SHEET = 2;   // 1 แผ่น = 2 ช่อง ตาม CSS .sticker-page (ระบบเดิมแบ่งชุดละ 4 ทำให้ล้นแผ่น)
    for (let i = 0; i < selectedDrugs.length; i += PER_SHEET) {
        const chunk = selectedDrugs.slice(i, i + PER_SHEET);
        const pageDiv = document.createElement('div');
        pageDiv.className = 'sticker-page';
        for (let slotIndex = 0; slotIndex < PER_SHEET; slotIndex++) {
            const item = chunk[slotIndex];
            const boxDiv = document.createElement('div');
            if (item) {
                boxDiv.className = 'sticker-box';
                const unitStr = item.unit || '';
                const expFormatted = formatThaiShortDate(item.expireDate);
                const qtyDisplay = (item.qty !== null && item.qty !== undefined && item.qty !== '') ? `${item.qty} ${unitStr}`.trim() : '-';
                boxDiv.innerHTML = `
                    <div class="sticker-drug-name">${esc(item.drugName)}</div>
                    <div class="sticker-line">Lot: <b>${esc(item.lotNumber || '-')}</b></div>
                    <div class="sticker-line">จำนวน: <b>${esc(qtyDisplay)}</b></div>
                    <div class="sticker-line">Exp: <b>${expFormatted}</b></div>`;
            } else {
                boxDiv.className = 'sticker-box empty-slot';
                boxDiv.innerHTML = `<div></div>`;
            }
            pageDiv.appendChild(boxDiv);
        }
        stickerContainer.appendChild(pageDiv);
    }
    runPrint('print-sticker-mode', `@media print { @page { size: 85mm 60mm; margin: 0; } body { padding: 0; margin: 0; } }`);
}

/* ป้ายกล่อง A4 แนวนอน 2 ฝั่ง */
function printBoxLabel(b) {
    // เรียงตามลำดับที่บันทึกเข้าระบบ (เหมือนระบบเดิมที่เรียงตามแถวใน Sheet)
    const drugs = itemsOf(b.id).sort((x, y) => x.id - y.id).map(x => ({ ...x }));
    if (!drugs.length) return Swal.fire({ icon: 'warning', title: 'ไม่พบข้อมูล', text: 'ไม่มีรายการยาในกล่องนี้', confirmButtonText: 'ตกลง' });
    const tbodies = $$('.lbl-tbody');
    tbodies.forEach(tb => tb.innerHTML = '');

    // วันหมดอายุกล่อง = ยาที่หมดเร็วที่สุด − 1 เดือน (คำนวณที่ server ปัดสิ้นเดือนถูกต้องแล้ว)
    const formattedBoxExp = b.boxExp ? formatThaiShortDate(b.boxExp) : '-';

    drugs.forEach(d => {
        const s = d.storageLoc || 'กล่องยาปิดผนึก';
        if (s.includes('ตู้เย็น')) d.cleanStorage = 'ตู้เย็น';
        else if (s.includes('ชั้นเก็บยา')) d.cleanStorage = 'ชั้นเก็บยา';
        else d.cleanStorage = 'กล่องปิดผนึก';
    });
    const storageGroups = new Map();
    drugs.forEach(item => {
        if (!storageGroups.has(item.cleanStorage)) storageGroups.set(item.cleanStorage, new Map());
        const drugGroup = storageGroups.get(item.cleanStorage);
        if (!drugGroup.has(item.drugName)) drugGroup.set(item.drugName, []);
        drugGroup.get(item.drugName).push(item);
    });
    let tableRows = '';
    let globalIndex = 1;
    storageGroups.forEach((drugMap, storageName) => {
        let totalRowsForStorage = 0;
        drugMap.forEach(lots => { totalRowsForStorage += lots.length; });
        let isFirstRowOfStorage = true;
        drugMap.forEach(lots => {
            const rowCountForDrug = lots.length;
            lots.forEach((item, i) => {
                const formattedItemExp = formatThaiShortDate(item.expireDate);
                tableRows += `<tr>`;
                if (i === 0) {
                    tableRows += `<td rowspan="${rowCountForDrug}">${globalIndex++}</td>`;
                    tableRows += `<td rowspan="${rowCountForDrug}" style="text-align: left; padding-left: 5px;">${esc(item.drugName)}</td>`;
                }
                tableRows += `<td>${esc(item.qty ?? '-')}</td>`;
                tableRows += `<td>${esc(item.lotNumber || '-')}</td>`;
                tableRows += `<td style="white-space: nowrap;">${formattedItemExp}</td>`;
                if (isFirstRowOfStorage) {
                    tableRows += `<td rowspan="${totalRowsForStorage}" class="col-storage">${storageName}</td>`;
                    isFirstRowOfStorage = false;
                }
                tableRows += `</tr>`;
            });
        });
    });
    tbodies.forEach(tb => tb.innerHTML = tableRows);
    $$('.lbl-box-name').forEach(el => el.innerText = b.name);
    $$('.lbl-box-exp').forEach(el => el.innerText = formattedBoxExp);
    const formattedDate = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
    $$('.lbl-print-date').forEach(span => span.innerText = formattedDate);
    runPrint('print-label-mode', `@media print { @page { size: A4 landscape; margin: 0; } body { padding: 5mm; } }`);
}

/* =====================================================================
   พิมพ์ — รายงาน (หัวกระดาษและคอลัมน์ตามระบบเดิม)
   ===================================================================== */
function legacyExpLabel(it, short) {
    if (it.expStatus === 'expired') return '(หมดอายุ)';
    if (it.expStatus === 'exp3m') return short ? '⚠️(< 3 ด.)' : '⚠️(ใน 3 เดือน)';
    if (it.expStatus === 'exp6m') return short ? '⚠️(< 6 ด.)' : '⚠️(ใน 6 เดือน)';
    return '';
}
const legacyExpStyle = it => ({ expired: 'color:#2c3e50;font-weight:bold;', exp3m: 'color:#e74c3c;font-weight:bold;', exp6m: 'color:#f39c12;font-weight:bold;' }[it.expStatus] || '');
function reportHead(title, subtitleHtml) {
    return `<div class="rp-head"><img src="${LOGO}" alt=""><h3>${title}</h3>${subtitleHtml ? `<p>${subtitleHtml}</p>` : ''}</div>`;
}
function printBoxReport(b) {
    const rows = sortRows(itemsOf(b.id), 'drugName', true);
    $('#report-print').className = '';
    $('#report-print').innerHTML = reportHead('รายงานสถานะคลังยา โรงพยาบาลจิตเวชเลยราชนครินทร์', `<b>หน่วยงาน:</b> ${esc(b.department)} | <b>กล่อง:</b> ${esc(b.name)}`)
        + `<table class="rp-table"><thead><tr><th>ชื่อยา</th><th>Lot Number</th><th>แหล่งเก็บ</th><th>วันหมดอายุ</th><th>จำนวน</th></tr></thead><tbody>${rows.map(it => `
        <tr><td><b style="font-weight:500">${esc(it.drugName)}</b><br><span class="rp-sub">อัปเดต: ${it.updatedAt ? parseYmd(it.updatedAt).toLocaleDateString('th-TH') : '-'} | โดย: ${esc(it.verifiedBy || '-')}</span></td>
        <td>${esc(it.lotNumber || '-')}</td><td><span class="rp-badge">${esc(it.storageLoc || 'ในกล่อง')}</span></td>
        <td style="${legacyExpStyle(it)}">${esc(it.expireDate || '-')} ${legacyExpLabel(it)}</td><td>${it.qty ?? '-'}</td></tr>`).join('')}</tbody></table>`;
    runPrint('print-report-mode', '');
}
function printListReport(rows, title) {
    $('#report-print').className = '';
    $('#report-print').innerHTML = reportHead('รายงานรายการยาสต็อก โรงพยาบาลจิตเวชเลยราชนครินทร์', esc(title))
        + `<table class="rp-table"><thead><tr><th>ตึก / กล่อง</th><th>ชื่อยา</th><th>Lot Number</th><th>วันหมดอายุ</th><th>จำนวน</th><th>แหล่งเก็บ</th></tr></thead><tbody>${rows.map(it => {
            const b = byId(S.boxes, it.boxId);
            return `<tr><td><span class="rp-badge">${esc(b.department)}</span><br><span style="font-size:0.8rem;color:#666">${esc(b.name)}</span></td><td><b style="font-weight:500">${esc(it.drugName)}</b></td><td>${esc(it.lotNumber || '-')}</td>
            <td style="${legacyExpStyle(it)}">${esc(it.expireDate || '-')} ${legacyExpLabel(it, true)}</td><td>${it.qty ?? '-'}</td><td><span class="rp-badge">${esc(it.storageLoc || 'ในกล่อง')}</span></td></tr>`;
        }).join('')}</tbody></table>`;
    runPrint('print-report-mode', '');
}
function printCalendar(m, y, items) {
    const first = new Date(y, m, 1).getDay(), dim = new Date(y, m + 1, 0).getDate();
    let cells = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map(d => `<div class="cal-header">${d}</div>`).join('');
    for (let i = 0; i < first; i++) cells += `<div class="cal-day empty"></div>`;
    for (let d = 1; d <= dim; d++) {
        cells += `<div class="cal-day"><div class="cal-date">${d}</div>${items.filter(it => parseYmd(it.expireDate).getDate() === d).map(it => `<div class="cal-event ${it.expStatus}">${esc(it.drugName)} (${esc(byId(S.boxes, it.boxId).department)})</div>`).join('')}</div>`;
    }
    $('#report-print').className = '';
    $('#report-print').innerHTML = reportHead(`ประจำเดือน ${THAI_MONTHS[m]} ${y + 543}`, '') + `<div class="calendar-grid">${cells}</div>`;
    runPrint('print-report-mode', `@media print { @page { size: landscape; margin: 1cm; } }`);
}
function printSection(tableId, title) {
    const t = $('#' + tableId).cloneNode(true);
    t.className = 'rp-table'; t.removeAttribute('id');
    $$('[data-noexport]', t).forEach(x => x.remove());
    $$('i.fas', t).forEach(x => x.remove());
    $('#report-print').className = 'rp-section';
    $('#report-print').innerHTML = `<h4 style="margin:0 0 15px">${esc(title)}</h4>`;
    $('#report-print').appendChild(t);
    runPrint('print-report-mode', '');
}

/* =====================================================================
   Export CSV (เปิดด้วย Excel ได้ ภาษาไทยไม่เพี้ยน)
   ===================================================================== */
function downloadCsv(rows, fileName) {
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `${fileName}_${ymd(new Date())}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function exportItemsCsv(items, name) {
    if (!items.length) return Swal.fire({ icon: 'info', title: 'ไม่มีข้อมูล', text: 'ไม่มีข้อมูลสำหรับ Export', confirmButtonText: 'ตกลง' });
    downloadCsv([['หน่วยงาน', 'ชื่อกล่อง', 'ชื่อยา', 'Lot Number', 'วันหมดอายุ', 'จำนวน', 'แหล่งเก็บ'],
        ...items.map(it => { const b = byId(S.boxes, it.boxId); return [b.department, b.name, it.drugName, it.lotNumber, it.expireDate, it.qty, it.storageLoc]; })], name);
}
function exportTableCsv(tableId, name) {
    const rows = $$(`#${tableId} tr`).map(tr => $$('th, td', tr).map(c => {
        if (c.dataset.csv !== undefined) return c.dataset.csv;
        const cl = c.cloneNode(true); $$('[data-noexport]', cl).forEach(x => x.remove());
        return cl.innerText.trim();
    }));
    downloadCsv(rows, name);
}

/* =====================================================================
   เริ่มทำงาน
   ===================================================================== */
window.addEventListener('DOMContentLoaded', () => {
    setupSearch();
    if (localStorage.getItem(TOKEN_KEY)) startApp().catch(() => forceLogout());
    else showAuth('login');
});

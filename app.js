const API_URL = 'https://script.google.com/macros/s/AKfycbwIbf8w_VSw5pCJXnUGtRgut8beeqG3wx2qkGbrU9fOHiaxbM5WA07FFBrZsbzxc3E3/exec';
const WARD_ORDER = ['พุทธรักษา', 'จำปาทอง', 'ราชาวดี', 'ลีลาวดี', 'ฉัตรชบา', 'ECT', 'ER'];

const DRUG_DICTIONARY = {
    "Adrenaline 1 mg/ml inj.": { unit: "Ampoule", prep: `<b>สารละลายที่เข้ากันได้:</b> <span style="color:var(--danger); font-weight:600;">NSS / D5W</span>`, admin: `<b>ข้อบ่งใช้:</b> Cardiac Arrest\n<b>ขนาดยา (IV/IO):</b> 1 mg every 3-5 minutes`, precautions: `-` },
    "Amiodarone 150 mg/3ml inj.": { unit: "Ampoule", prep: `<b>สารละลายที่เข้ากันได้:</b> <span style="color:var(--danger); font-weight:600;">D5W</span>`, admin: `<b>ข้อบ่งใช้:</b> Cardiac Arrest (refractory VF/pVT)\n<b>ขนาดยา (IV/IO):</b>\n- First dose: 300 mg bolus\n- Second dose: 150 mg`, precautions: `-` },
    "Atropine 0.6 mg/ml inj.": { unit: "Ampoule", prep: `-`, admin: `<b>ข้อบ่งใช้:</b> Bradycardia\n<b>ขนาดยา (IV):</b>\n- First dose: 1 mg bolus\n- Repeat every 3-5 minutes\n- <b>Maximum:</b> 3 mg`, precautions: `-` },
    "Calcium gluconate 4.5 mEq/ml inj. (10ml)": { unit: "Ampoule", prep: `<b>สารละลายที่ใช้ผสมได้:</b> SWI, D5W, D10W, D5S และ NSS\n\n<span style="color:var(--danger); font-weight:600;">⚠️ ยาที่ห้ามผสมร่วมกัน (Incompatibilities):</span>\nNSS, Bicarbonates, Carbonates, Phosphates, Sulfates, Clindamycin Phosphate, Amphotericin B`, admin: `<b>ข้อบ่งใช้:</b> Cardiac arrest หรือ Cardiotoxicity จาก hyperkalemia\n<b>ขนาดยา:</b> 0.5-1g (5-10 ml) IV push ช้าๆ (2-5 min)\n- อาจให้ซ้ำถ้าอาการรุนแรง (Max: 3g หรือ 30 ml)\n\n<b>ข้อบ่งใช้:</b> Hypocalcaemia\n<b>ขนาดยา:</b> IV 2-15 g/24 hr แบบ continuous infusion หรือแบ่งให้ 4 ครั้ง\n\n<b>การบริหารยา:</b> Direct IV (over 5-10 min) หรือ Infusion (rate 50 mg/ml นานกว่า 1 hr หรือไม่เกิน 120-240 mg/kg/hr หรือ 0.6-1.2 mEq/kg/hr)`, precautions: `• Calcium gluconate 1 g (เท่ากับ 10% calcium gluconate Injection 10 mL) เจือจางในสารน้ำที่เข้ากันได้อย่างน้อย 50 mL\n• ความเข้มข้นสูงสุดสำหรับผู้ป่วยเด็ก คือ ไม่เกิน 50 mg/mL` },
    "Lidocaine 2% inj. (2ml)": { unit: "Ampoule", prep: `<b>สารละลายที่ใช้ผสมได้:</b> D5W, LRS, NSS, NSS/2, D5S และ D5S/2`, admin: `<b>ข้อบ่งใช้:</b> Cardiac Arrest (refractory VF/pVT)\n<b>ขนาดยา (IV/IO):</b>\n- First dose: 1-1.5 mg/kg\n- Second dose: 0.5-0.75 mg/kg\n\n<b>การบริหารยา:</b> Loading dose 1-1.5 mg/kg IV slowly push สามารถให้ซ้ำได้อีกครั้งละ 0.5-0.75 mg/kg ทุก 10 นาที (ขนาดยารวมกันไม่เกิน 3 mg/kg) และให้ยาต่อไปด้วยวิธี IV continuous infusion ต่อไปด้วยอัตราเร็ว 1-4 mg/min`, precautions: `-` }
};

const app = {
    user: null, currentBoxId: null, currentBoxDept: null, currentBoxType: null, currentBoxName: null, currentBoxStatus: null,
    masterData: { departments: [], drugs: [] },
    tomSelectInstance: null,

    async init() {
        await this.loadMasterData();
        const userStr = localStorage.getItem('rxUser');
        if (userStr) {
            this.user = JSON.parse(userStr);
            this.showMainApp();
            this.loadDashboardData();
        } else {
            this.navigateAuth('page-login');
        }
    },

    navigateAuth(pageId) {
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('auth-container').style.display = 'block';
        document.querySelectorAll('#auth-container .page').forEach(el => el.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
    },

    showMainApp() {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        document.getElementById('user-display').innerText = `${this.user.username} (${this.user.dept})`;
    },

    navigateMenu(pageId, menuItem = null) {
        document.querySelectorAll('main .page').forEach(el => el.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        if (menuItem) {
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            menuItem.classList.add('active');
        }
        if(window.innerWidth <= 768) this.toggleSidebar();
    },

    toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('open');
        document.querySelector('.sidebar-overlay').classList.toggle('active');
    },

    showLoader(show) { document.getElementById('loader').style.display = show ? 'flex' : 'none'; },

    async callAPI(payload) {
        this.showLoader(true);
        try {
            const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
            const data = await res.json();
            this.showLoader(false);
            return data;
        } catch (err) {
            this.showLoader(false);
            alert('การเชื่อมต่อขัดข้อง หรือ URL API ไม่ถูกต้อง');
        }
    },

    async loadMasterData() {
        const res = await this.callAPI({ action: 'get_master_data' });
        if (res && res.status === 'success') {
            this.masterData = res;
            
            const deptSelect = document.getElementById('reg-dept');
            if (deptSelect) {
                deptSelect.innerHTML = '<option value="">-- เลือกหน่วยงาน --</option>';
                res.departments.forEach(dept => deptSelect.innerHTML += `<option value="${dept}">${dept}</option>`);
            }

            const drugList = document.getElementById('drug-master-list');
            if (drugList) {
                drugList.innerHTML = '';
                res.drugs.forEach(drug => drugList.innerHTML += `<option value="${drug.name}">`);
            }

            const drugInput = document.getElementById('form-drug-name');
            if (drugInput) {
                drugInput.addEventListener('input', (e) => {
                    const selectedDrug = res.drugs.find(d => d.name === e.target.value);
                    const unitDisplay = document.getElementById('form-unit-display');
                    unitDisplay.innerText = (selectedDrug && selectedDrug.unit) ? `(${selectedDrug.unit})` : '';
                });
            }

            const searchSelect = document.getElementById('search-drug-info');
            if (searchSelect) {
                searchSelect.innerHTML = '<option value="">พิมพ์ชื่อยาเพื่อค้นหา...</option>';
                res.drugs.forEach(drug => searchSelect.innerHTML += `<option value="${drug.name}">${drug.name}</option>`);
                if (this.tomSelectInstance) this.tomSelectInstance.destroy();
                this.tomSelectInstance = new TomSelect("#search-drug-info", { create: false, sortField: { field: "text", direction: "asc" }, onChange: (value) => this.showDrugInfo(value) });
            }
        }
    },

    showDrugInfo(drugName) {
        const displayDiv = document.getElementById('drug-info-display');
        if (!drugName) { displayDiv.style.display = 'none'; return; }
        const drugInfo = DRUG_DICTIONARY[drugName];
        document.getElementById('info-drug-name').innerText = drugName;
        if (drugInfo) {
            document.getElementById('info-drug-unit').innerText = drugInfo.unit || '-';
            document.getElementById('info-drug-prep').innerHTML = drugInfo.prep || 'ไม่มีข้อมูล';
            document.getElementById('info-drug-admin').innerHTML = drugInfo.admin || 'ไม่มีข้อมูล';
            document.getElementById('info-drug-precautions').innerHTML = drugInfo.precautions || 'ไม่มีข้อมูล';
        } else {
            document.getElementById('info-drug-unit').innerText = '-';
            document.getElementById('info-drug-prep').innerHTML = '<span style="color:#999;"><i>ไม่มีข้อมูล</i></span>';
            document.getElementById('info-drug-admin').innerHTML = '<span style="color:#999;"><i>ไม่มีข้อมูล</i></span>';
            document.getElementById('info-drug-precautions').innerHTML = '<span style="color:#999;"><i>ไม่มีข้อมูล</i></span>';
        }
        displayDiv.style.display = 'block';
    },

    async login() {
        const u = document.getElementById('login-username').value;
        const p = document.getElementById('login-password').value;
        if (!u || !p) return alert("กรุณากรอก Username และ Password");
        const res = await this.callAPI({ action: 'login', username: u, password: p });
        if (res && res.status === 'success') {
            this.user = res.user;
            localStorage.setItem('rxUser', JSON.stringify(res.user));
            this.showMainApp();
            this.loadDashboardData();
        } else alert(res ? res.message : 'เข้าสู่ระบบล้มเหลว');
    },

    async register() {
        const u = document.getElementById('reg-username').value;
        const p = document.getElementById('reg-password').value;
        const e = document.getElementById('reg-email').value;
        const d = document.getElementById('reg-dept').value;
        if (!u || !p || !e) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        const res = await this.callAPI({ action: 'register', username: u, password: p, email: e, role: 'User', department: d });
        if (res && res.status === 'success') {
            alert("ลงทะเบียนสำเร็จ กรุณาเข้าสู่ระบบ");
            this.navigateAuth('page-login');
            ['reg-username', 'reg-password', 'reg-email'].forEach(id => document.getElementById(id).value = '');
        } else alert(res ? res.message : 'เกิดข้อผิดพลาด');
    },

    async forgotPassword() {
        const e = document.getElementById('forgot-email').value;
        if (!e) return alert("กรุณากรอก E-mail");
        const res = await this.callAPI({ action: 'reset_password', email: e });
        if (res && res.status === 'success') {
            alert(res.message);
            this.navigateAuth('page-login');
            document.getElementById('forgot-email').value = '';
        } else alert(res ? res.message : 'ไม่พบ E-mail นี้');
    },

    logout() {
        localStorage.removeItem('rxUser');
        this.user = null;
        ['login-username', 'login-password'].forEach(id => document.getElementById(id).value = '');
        this.navigateAuth('page-login');
    },

    async loadDashboardData() {
        const res = await this.callAPI({ action: 'get_dashboard' });
        if (res && res.status === 'success') {
            let totalBoxes = 0, totalDrugs = 0, exp3m = 0;
            const container = document.getElementById('ward-grid-container');
            container.innerHTML = '';

            const sortedBoxes = res.data.sort((a, b) => {
                let indexA = WARD_ORDER.indexOf(a.department);
                let indexB = WARD_ORDER.indexOf(b.department);
                if(indexA === -1) indexA = 999; 
                if(indexB === -1) indexB = 999;
                return indexA - indexB;
            });

            sortedBoxes.forEach(box => {
                totalBoxes++;
                totalDrugs += box.totalDrugs;
                exp3m += box.expiringSoon;
                
                const isWarning = box.expiringSoon > 0;
                let boxColorClass = 'box-ward'; 
                const typeStr = box.boxType.toLowerCase();
                if (typeStr.includes('cpr')) boxColorClass = 'box-cpr'; 
                else if (typeStr.includes('urgency')) boxColorClass = 'box-urgency'; 

                // เช็คว่าถูกส่งไปเภสัชฯ ไหม
                const isSent = (box.boxStatus === 'ส่งปรับแก้');

                const card = document.createElement('div');
                card.className = `box-card ${boxColorClass} ${isWarning ? 'warning' : ''}`;
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between;">
                        <div class="box-title">${box.boxName}</div>
                        ${isSent ? `<span style="background:var(--danger); color:white; padding:2px 6px; border-radius:4px; font-size:0.75rem;">รอเภสัชฯ</span>` : ''}
                    </div>
                    <div style="margin-bottom: 8px;"><span class="box-badge">${box.boxType}</span></div>
                    <div style="color: #666; margin: 10px 0;"><i class="fas fa-clinic-medical"></i> ${box.department}</div>
                    <div style="font-size: 0.9rem; border-top: 1px solid #eee; padding-top: 10px;">
                        รายการยา: <b>${box.totalDrugs}</b><br>
                        ${isWarning ? `<span style="color:var(--danger); font-weight: 600;">⚠️ ใกล้หมดอายุ: ${box.expiringSoon}</span>` : `<span style="color:var(--primary-green); font-weight: 500;">✅ ยาไม่หมดอายุ</span>`}
                    </div>
                `;
                card.onclick = () => this.openBoxDetail(box.id, box.department, box.boxType, box.boxName, box.boxStatus);
                container.appendChild(card);
            });

            document.getElementById('stat-total-boxes').innerText = totalBoxes;
            document.getElementById('stat-total-drugs').innerText = totalDrugs;
            document.getElementById('stat-exp-3m').innerText = exp3m;
        }

        const logRes = await this.callAPI({ action: 'get_recent_logs' });
        if (logRes && logRes.status === 'success') {
            const tbody = document.getElementById('dashboard-logs-tbody');
            tbody.innerHTML = '';
            if (logRes.data.length === 0) tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">ยังไม่มีประวัติ</td></tr>';
            else logRes.data.forEach(log => {
                const actColor = log.action === 'STATUS' ? '#3498db' : (log.action === 'INSERT' ? 'var(--primary-green)' : (log.action === 'STOCK_TAKE' ? '#27ae60' : '#f39c12'));
                tbody.innerHTML += `<tr><td style="font-size: 0.85rem; color: #666;">${log.timestamp}</td><td><span style="background: ${actColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${log.action}</span></td><td>${log.details}</td><td style="font-weight: 500;">${log.user}</td></tr>`;
            });
        }
    },

    async openBoxDetail(boxId, dept, type, boxName, boxStatus) {
        this.currentBoxId = boxId; this.currentBoxDept = dept; this.currentBoxType = type; this.currentBoxName = boxName; this.currentBoxStatus = boxStatus;
        
        // ตรวจสอบสิทธิ์ว่าเป็นเภสัชฯ หรือเป็นเจ้าของตึก
        const isPharmacy = (this.user.role === 'God Admin' || this.user.role === 'Admin' || this.user.dept === 'กลุ่มงานเภสัชกรรม');
        const isOwner = (this.user.dept === dept);
        const canEdit = isPharmacy || isOwner;

        document.getElementById('detail-title').innerText = `${boxName} (${type})`;
        document.getElementById('print-dept-name').innerText = dept;
        document.getElementById('print-box-name').innerText = boxName;
        
        this.navigateMenu('page-box-detail');
        
        // 📌 ซ่อน/แสดง ปุ่มด้านบนตามสิทธิ์
        document.getElementById('btn-add-drug').style.display = canEdit ? 'block' : 'none';
        
        // เจ้าของกล่องที่ไม่ใช่เภสัช สามารถกดส่งให้เภสัชได้
        document.getElementById('btn-send-pharma').style.display = (!isPharmacy && isOwner && boxStatus !== 'ส่งปรับแก้') ? 'block' : 'none';
        
        // เภสัชสามารถกดเคลียร์สถานะได้ ถ้ากล่องนั้นโดนส่งมา
        document.getElementById('btn-clear-status').style.display = (isPharmacy && boxStatus === 'ส่งปรับแก้') ? 'block' : 'none';

        const res = await this.callAPI({ action: 'get_box_detail', boxId: boxId });
        if (res && res.status === 'success') {
            const tbody = document.getElementById('detail-tbody');
            tbody.innerHTML = '';
            if(res.data.length === 0) return tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">ไม่พบรายการยา</td></tr>';

            const threeMonths = new Date();
            threeMonths.setDate(new Date().getDate() + 90);

            res.data.forEach(item => {
                const expDate = new Date(item.expireDate);
                const isExpiring = expDate <= threeMonths;
                const itemJson = encodeURIComponent(JSON.stringify(item));
                
                // สร้างปุ่มจัดการ (มีทั้งแก้ไข และ ยืนยันถูกต้องรายตัว)
                let actionButtons = '-';
                if (canEdit) {
                    actionButtons = `
                        <button class="btn-outline no-print" style="margin-right:5px; border-color:#27ae60; color:#27ae60;" onclick="app.verifyItem('${item.itemID}')" title="ตรวจสอบว่าถูกต้อง"><i class="fas fa-check"></i></button>
                        <button class="btn-outline no-print" onclick="app.openDrugModal('${itemJson}')" title="แก้ไขรายการ"><i class="fas fa-edit"></i></button>
                    `;
                }
                
                tbody.innerHTML += `
                    <tr>
                        <td>
                            <b style="font-weight: 500;">${item.drugName}</b><br>
                            <span style="font-size:0.75rem; color:#999;">อัปเดต: ${new Date(item.lastUpdate).toLocaleDateString('th-TH')} | โดย: ${item.verifiedBy || '-'}</span>
                        </td>
                        <td>${item.lotNumber}</td>
                        <td><span style="font-size:0.85rem; color:var(--text-dark); background:#eee; padding:3px 8px; border-radius:4px;">${item.storageLoc || 'ในกล่อง'}</span></td>
                        <td class="${isExpiring ? 'exp-warning' : ''}">${item.expireDate} ${isExpiring ? '⚠️' : ''}</td>
                        <td>${item.qty}</td>
                        <td class="no-print" style="white-space: nowrap;">${actionButtons}</td>
                    </tr>
                `;
            });
        }
    },

    // 📌 ยืนยันความถูกต้องรายตัว
    async verifyItem(itemId) {
        const res = await this.callAPI({ action: 'verify_item', itemID: itemId, username: this.user.username });
        if (res && res.status === 'success') {
            this.openBoxDetail(this.currentBoxId, this.currentBoxDept, this.currentBoxType, this.currentBoxName, this.currentBoxStatus);
        } else alert('เกิดข้อผิดพลาดในการบันทึก');
    },

    // 📌 เปลี่ยนสถานะกล่อง (ส่งเภสัช / เคลียร์)
    async updateBoxStatus(status) {
        let confirmMsg = status === 'ส่งปรับแก้' ? "ต้องการส่งกล่องนี้ให้ฝ่ายเภสัชกรรมปรับแก้ใช่หรือไม่?" : "ยืนยันการเคลียร์สถานะว่าปรับแก้เรียบร้อยแล้ว?";
        if (!confirm(confirmMsg)) return;

        const res = await this.callAPI({ action: 'update_box_status', boxName: this.currentBoxName, department: this.currentBoxDept, status: status, username: this.user.username });
        if (res && res.status === 'success') {
            alert(res.message);
            this.loadDashboardData();
            this.navigateMenu('page-wards'); // กลับไปหน้าตารางวอร์ด
        } else alert('เกิดข้อผิดพลาด');
    },

    openDrugModal(itemJsonEncoded = null) {
        document.getElementById('modal-drug').style.display = 'flex';
        if (itemJsonEncoded) {
            document.getElementById('modal-title').innerText = "แก้ไขรายการยา";
            const item = JSON.parse(decodeURIComponent(itemJsonEncoded));
            document.getElementById('form-item-id').value = item.itemID;
            ['drug-name', 'lot', 'qty', 'exp'].forEach(id => {
                const key = id === 'drug-name' ? 'drugName' : (id === 'lot' ? 'lotNumber' : (id === 'exp' ? 'expireDate' : id));
                document.getElementById('form-' + id).value = item[key];
            });
            document.getElementById('form-storage').value = item.storageLoc || 'ในกล่อง (In Box)';
            document.getElementById('form-unit-display').innerText = ''; 
            document.getElementById('form-is-opened').checked = false; 
            document.getElementById('form-verifier').value = this.user.username; // ดึงชื่อ User อัตโนมัติ
        } else {
            document.getElementById('modal-title').innerText = "เพิ่มรายการยาใหม่";
            ['item-id', 'drug-name', 'lot', 'qty', 'exp'].forEach(id => document.getElementById('form-' + id).value = '');
            document.getElementById('form-storage').value = 'ในกล่อง (In Box)';
            document.getElementById('form-unit-display').innerText = '';
            document.getElementById('form-is-opened').checked = false;
            document.getElementById('form-verifier').value = this.user.username; // ดึงชื่อ User อัตโนมัติ
        }
    },

    closeModal() { document.getElementById('modal-drug').style.display = 'none'; },

    async saveDrug() {
        const payload = {
            action: 'save_drug',
            itemID: document.getElementById('form-item-id').value,
            boxId: this.currentBoxId, boxType: this.currentBoxType, boxName: this.currentBoxName, department: this.currentBoxDept,
            drugName: document.getElementById('form-drug-name').value,
            lotNumber: document.getElementById('form-lot').value,
            qty: document.getElementById('form-qty').value,
            storageLoc: document.getElementById('form-storage').value,
            expireDate: document.getElementById('form-exp').value,
            isOpened: document.getElementById('form-is-opened').checked,
            status: 'Active', username: this.user.username,
            verifiedBy: document.getElementById('form-verifier').value
        };

        if (!payload.drugName || (!payload.expireDate && !payload.isOpened) || !payload.verifiedBy) return alert("กรุณากรอก ชื่อยา, วันหมดอายุ และ ชื่อผู้ตรวจสอบ");

        const res = await this.callAPI(payload);
        if (res && res.status === 'success') {
            alert(res.message);
            this.closeModal();
            this.openBoxDetail(this.currentBoxId, this.currentBoxDept, this.currentBoxType, this.currentBoxName, this.currentBoxStatus);
        } else alert('เกิดข้อผิดพลาด: ' + (res ? res.message : 'ไม่ทราบสาเหตุ'));
    }
};

window.onload = () => app.init();

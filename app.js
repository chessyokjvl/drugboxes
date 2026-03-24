const API_URL = 'https://script.google.com/macros/s/AKfycbwIbf8w_VSw5pCJXnUGtRgut8beeqG3wx2qkGbrU9fOHiaxbM5WA07FFBrZsbzxc3E3/exec';
// ==========================================
// 📚 ฐานข้อมูลคู่มือยา (Local Drug Dictionary)
// ==========================================
// คุณสามารถมาเพิ่ม/แก้ไข ข้อมูลยาตรงนี้ได้เลยโดยใช้ HTML จัดรูปแบบให้สวยงาม
const DRUG_DICTIONARY = {
    "Adrenaline 1mg/1ml inj.": {
        unit: "Ampoule",
        prep: `<b>กรณี CPR:</b> 10 mg (10 ml) + NSS/D5W up to 100 ml (Concentration 1:10)
<br><b>ตัวอย่าง:</b> Adrenaline 10 mg (10 ml) + NSS up to 100 ml (1:10) IV rate 5 ml/hr`,
        admin: `<b>CPR:</b> 0.5-1mg (5-10 ml) IV stat, ให้ซ้ำ 5 ml IV ทุก 5 นาที
<b>Unstable bradycardia:</b> เริ่มต้น 1.2 ml/hr (ปรับทีละ 5, Max 6 ml/hr)
<b>Post-cardiac arrest / Refractory shock:</b> เริ่มต้น 5 ml/hr (ปรับทีละ 5, Max 36 ml/hr)`,
        precautions: `• ขนาดยาเด็ก: 0.01 mg/Kg/dose
• <b>ข้อควรระวัง:</b> หากเก็บนอกตู้เย็น อายุยาเหลือ 12 เดือนที่อุณหภูมิห้อง`
    },
    "Norepinephrine": {
        unit: "Ampoule",
        prep: `<b>Shock/Hypotension:</b> 1.6 mg (1.6 ml) + D5W up to 100 ml (Concentration 4:250)
<br><b>ตัวอย่าง:</b> Norepinephrine 1.6 mg (1.6 ml) + D5W up to 100 ml IV rate 5 ml/hr`,
        admin: `<b>IV rate:</b> เริ่มต้น 5 ml/hr 
<b>การปรับ Dose:</b> ปรับเพิ่มทีละ 8 ml/hr
<b>Max dose:</b> 450 ml/hr`,
        precautions: `• <b>ข้อควรระวัง:</b> ระวัง smoking - limb ischemia (ภาวะขาดเลือดที่แขนขา)`
    },
    "Dopamine": {
        unit: "Ampoule",
        prep: `<b>Unstable bradycardia:</b> 100 mg (4 ml) + NSS up to 100 ml (Concentration 1:1)
<br><b>ตัวอย่าง:</b> Dopamine 100 mg (4 ml) + NSS up to 100 ml (1:1) IV rate 20 ml/hr`,
        admin: `<b>IV rate:</b> เริ่มต้น 20 ml/hr
<b>การปรับ Dose:</b> ปรับเพิ่มทีละ 10 ml/hr
<b>Max dose:</b> 72 ml/hr`,
        precautions: `• <b>ข้อควรระวัง:</b> ระวังภาวะ MI และ Tachyarrhythmia`
    },
    "Amiodarone 50 mg/ml inj. (3ml)": {
        unit: "Ampoule",
        prep: `<b>AF / Stable VT:</b> 150 mg (3 ml) + D5W up to 100 ml
<b>ตัวอย่างต่อเนื่อง:</b> 900 mg (16 ml) + D5W 500 ml
<br><b>CPR Box:</b> 150 mg (3 ml) + D5W up to 100 ml (Concentration 15:10)`,
        admin: `<b>Dose แรก:</b> IV drip in 30 mins (Rate 200 ml/hr)
<b>Dose ต่อเนื่อง:</b> จากนั้น 900 mg IV drip in 24 hr`,
        precautions: `• <span style="color:red; font-weight:bold;">ห้ามให้ใน case QT prolonged</span>
• แนะนำให้เก็บ Thyroid Function Test (TFT) ก่อนให้ยา`
    },
    "Lidocaine": {
        unit: "Vial/Ampoule",
        prep: `<b>Monomorphic VT:</b> 2% Lidocaine 60 mg (3 ml) หรือ 80 mg (4 ml)
<b>Maintenance:</b> 400 mg (20 ml) in NSS 100 ml`,
        admin: `<b>Dose แรก:</b> Slowly push ช้าๆ 5-10 นาที (สามารถ repeat dose ทุก 10-15 นาที)
<b>Maintenance:</b> 400 mg in NSS 100 ml IV rate 15 ml/hr`,
        precautions: `• ระวังเรื่องการให้เร็วเกินไป อาจเกิดพิษจาก Lidocaine (Neurotoxicity, Arrhythmia)`
    },
    "Magnesium sulfate (MgSO4)": {
        unit: "Ampoule",
        prep: `<b>Stable torsade de pointes:</b>
<b>Dose 1:</b> 50% MgSO4 2 gms (4 ml) + NSS up to 100 ml
<b>Dose 2:</b> 50% MgSO4 4 gms (8 ml) + NSS up to 100 ml`,
        admin: `<b>Dose 1:</b> Drip in 15 mins (IV rate 400 ml/hr)
<b>Dose 2 (then):</b> Drip in 4 hrs (IV rate 25 ml/hr)`,
        precautions: `• เฝ้าระวังระดับ Magnesium ในเลือด, Deep tendon reflexes (DTR) และอัตราการหายใจ`
    }
};

// ==========================================
// 🚀 เริ่มการทำงานของระบบ (Main Application)
// ==========================================
const app = {
    user: null, currentBoxId: null, currentBoxDept: null, currentBoxType: null,
    masterData: { departments: [], drugs: [] },
    tomSelectInstance: null,

    async init() {
        await this.loadMasterData();
        const userStr = localStorage.getItem('rxUser');
        if (userStr) {
            this.user = JSON.parse(userStr);
            this.loadDashboard();
        } else {
            this.navigate('page-login');
        }
    },

    navigate(pageId) {
        document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
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
            console.error(err);
        }
    },

    async loadMasterData() {
        const res = await this.callAPI({ action: 'get_master_data' });
        if (res && res.status === 'success') {
            this.masterData = res;
            
            // 1. Setup Dropdown แผนก
            const deptSelect = document.getElementById('reg-dept');
            if (deptSelect) {
                deptSelect.innerHTML = '<option value="">-- เลือกหน่วยงาน --</option>';
                res.departments.forEach(dept => {
                    deptSelect.innerHTML += `<option value="${dept}">${dept}</option>`;
                });
            }

            // 2. Setup Autocomplete รายชื่อยา (Modal)
            const drugList = document.getElementById('drug-master-list');
            if (drugList) {
                drugList.innerHTML = '';
                res.drugs.forEach(drug => {
                    drugList.innerHTML += `<option value="${drug.name}">`;
                });
            }

            // 3. ระบบดึงหน่วยนับอัตโนมัติ (Modal)
            const drugInput = document.getElementById('form-drug-name');
            if (drugInput) {
                drugInput.addEventListener('input', (e) => {
                    const selectedDrug = res.drugs.find(d => d.name === e.target.value);
                    const unitDisplay = document.getElementById('form-unit-display');
                    unitDisplay.innerText = (selectedDrug && selectedDrug.unit) ? `(${selectedDrug.unit})` : '';
                });
            }

            // 4. ระบบ Tom Select (หน้าคู่มือยา)
            const searchSelect = document.getElementById('search-drug-info');
            if (searchSelect) {
                searchSelect.innerHTML = '<option value="">พิมพ์ชื่อยาเพื่อค้นหา...</option>';
                // ดึงรายชื่อยามาใส่ในช่องค้นหา (ดึงจากทั้ง Sheet และ Local Dictionary เผื่อไว้)
                res.drugs.forEach(drug => {
                    searchSelect.innerHTML += `<option value="${drug.name}">${drug.name}</option>`;
                });
                
                if (this.tomSelectInstance) this.tomSelectInstance.destroy();
                this.tomSelectInstance = new TomSelect("#search-drug-info", {
                    create: false,
                    sortField: { field: "text", direction: "asc" },
                    onChange: (value) => this.showDrugInfo(value)
                });
            }
        }
    },

    // ==========================================
    // 📖 ฟังก์ชันแสดงข้อมูลคู่มือยา
    // ==========================================
    showDrugInfo(drugName) {
        const displayDiv = document.getElementById('drug-info-display');
        if (!drugName) { displayDiv.style.display = 'none'; return; }
        
        // ค้นหาข้อมูลจาก Local Dictionary ก่อน ถ้าไม่มีค่อยแสดงค่า Default
        const drugInfo = DRUG_DICTIONARY[drugName];
        
        document.getElementById('info-drug-name').innerText = drugName;
        
        if (drugInfo) {
            document.getElementById('info-drug-unit').innerText = drugInfo.unit || '-';
            document.getElementById('info-drug-prep').innerHTML = drugInfo.prep || 'ไม่มีข้อมูล';
            document.getElementById('info-drug-admin').innerHTML = drugInfo.admin || 'ไม่มีข้อมูล';
            document.getElementById('info-drug-precautions').innerHTML = drugInfo.precautions || 'ไม่มีข้อมูล';
        } else {
            document.getElementById('info-drug-unit').innerText = '-';
            document.getElementById('info-drug-prep').innerHTML = '<span style="color:#999;"><i>ยังไม่ได้อัปเดตข้อมูลคู่มือสำหรับยานี้</i></span>';
            document.getElementById('info-drug-admin').innerHTML = '<span style="color:#999;"><i>ยังไม่ได้อัปเดตข้อมูลคู่มือสำหรับยานี้</i></span>';
            document.getElementById('info-drug-precautions').innerHTML = '<span style="color:#999;"><i>ยังไม่ได้อัปเดตข้อมูลคู่มือสำหรับยานี้</i></span>';
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
            this.loadDashboard();
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
            this.navigate('page-login');
            ['reg-username', 'reg-password', 'reg-email'].forEach(id => document.getElementById(id).value = '');
        } else alert(res ? res.message : 'เกิดข้อผิดพลาด');
    },

    async forgotPassword() {
        const e = document.getElementById('forgot-email').value;
        if (!e) return alert("กรุณากรอก E-mail");
        const res = await this.callAPI({ action: 'reset_password', email: e });
        if (res && res.status === 'success') {
            alert(res.message);
            this.navigate('page-login');
            document.getElementById('forgot-email').value = '';
        } else alert(res ? res.message : 'ไม่พบ E-mail นี้');
    },

    logout() {
        localStorage.removeItem('rxUser');
        this.user = null;
        ['login-username', 'login-password'].forEach(id => document.getElementById(id).value = '');
        this.navigate('page-login');
    },

    async loadDashboard() {
        document.getElementById('user-display').innerText = `👨‍⚕️ ผู้ใช้: ${this.user.username} (${this.user.role})`;
        this.navigate('page-dashboard');
        
        const res = await this.callAPI({ action: 'get_dashboard' });
        if (res && res.status === 'success') {
            const container = document.getElementById('dashboard-container');
            container.innerHTML = '';
            if (res.data.length === 0) container.innerHTML = '<p style="color:#666; width:100%; text-align:center;">ยังไม่มีข้อมูลกล่องยาในระบบ</p>';
            
            res.data.forEach(box => {
                const isWarning = box.status === 'warning';
                const card = document.createElement('div');
                card.className = `box-card ${isWarning ? 'warning' : ''}`;
                card.innerHTML = `
                    <div class="box-title">${box.boxType}</div>
                    <div style="color: #666; margin: 10px 0;"><i class="fas fa-hospital"></i> ${box.department}</div>
                    <div style="font-size: 0.9rem; padding-top: 10px; border-top: 1px solid #eee;">
                        <span>รายการทั้งหมด: <b>${box.totalDrugs}</b></span><br>
                        ${isWarning ? `<span style="color:var(--danger); font-weight: 600;">⚠️ ใกล้หมดอายุ: ${box.expiringSoon} รายการ</span>` : `<span style="color:var(--primary-green); font-weight: 500;">✅ สถานะปกติ</span>`}
                    </div>
                `;
                card.onclick = () => this.openBoxDetail(box.id, box.department, box.boxType);
                container.appendChild(card);
            });
        }

        const logRes = await this.callAPI({ action: 'get_recent_logs' });
        if (logRes && logRes.status === 'success') {
            const tbody = document.getElementById('dashboard-logs-tbody');
            tbody.innerHTML = '';
            if (logRes.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #666;">ยังไม่มีประวัติ</td></tr>';
            } else {
                logRes.data.forEach(log => {
                    const actColor = log.action === 'INSERT' ? 'var(--primary-green)' : (log.action === 'STOCK_TAKE' ? '#27ae60' : '#f39c12');
                    const actText = log.action === 'INSERT' ? 'เพิ่มยาใหม่' : (log.action === 'STOCK_TAKE' ? 'Re-check' : 'อัปเดตข้อมูล');
                    tbody.innerHTML += `
                        <tr>
                            <td style="font-size: 0.85rem; color: #666;">${log.timestamp}</td>
                            <td><span style="background: ${actColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${actText}</span></td>
                            <td>${log.details}</td>
                            <td><i class="fas fa-user-edit" style="color: #ccc;"></i> ${log.user}</td>
                            <td style="font-weight: 500;"><i class="fas fa-check-circle" style="color: var(--primary-green);"></i> ${log.verifiedBy}</td>
                        </tr>
                    `;
                });
            }
        }
    },

    async openBoxDetail(boxId, dept, type) {
        this.currentBoxId = boxId; this.currentBoxDept = dept; this.currentBoxType = type;
        document.getElementById('detail-title').innerText = `${type} - ${dept}`;
        document.getElementById('print-dept-name').innerText = dept;
        document.getElementById('print-box-name').innerText = type;
        document.getElementById('print-date').innerText = new Date().toLocaleString('th-TH');
        
        this.navigate('page-box-detail');
        
        const btnAdd = document.getElementById('btn-add-drug');
        btnAdd.style.display = (this.user.role === 'God Admin' || this.user.role === 'Admin') ? 'block' : 'none';
        btnAdd.onclick = () => this.openDrugModal();

        const btnStockTake = document.getElementById('btn-stock-take');
        btnStockTake.style.display = (this.user.role === 'God Admin' || this.user.role === 'Admin' || this.user.dept === dept) ? 'block' : 'none';

        const res = await this.callAPI({ action: 'get_box_detail', boxId: boxId });
        if (res && res.status === 'success') {
            const tbody = document.getElementById('detail-tbody');
            tbody.innerHTML = '';
            if(res.data.length === 0) return tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">ไม่พบรายการยา</td></tr>';

            const threeMonths = new Date();
            threeMonths.setDate(new Date().getDate() + 90);

            res.data.forEach(item => {
                const expDate = new Date(item.expireDate);
                const isExpiring = expDate <= threeMonths;
                const itemJson = encodeURIComponent(JSON.stringify(item));
                
                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight: 500;">${item.drugName}</td>
                        <td>${item.lotNumber}</td>
                        <td><span style="font-size:0.85rem; color:var(--primary-green); background:var(--light-green); padding:3px 8px; border-radius:4px;">${item.storageLoc || 'ในกล่อง'}</span></td>
                        <td class="${isExpiring ? 'exp-warning' : ''}">${item.expireDate} ${isExpiring ? '⚠️' : ''}</td>
                        <td>${item.qty}</td>
                        <td style="font-size: 0.85rem; color: #666;">${new Date(item.lastUpdate).toLocaleDateString('th-TH')}</td>
                        <td class="no-print">${(this.user.role === 'God Admin' || this.user.role === 'Admin') ? `<button class="btn-outline" style="color:var(--text-dark); border-color:#ccc; padding: 5px 10px;" onclick="app.openDrugModal('${itemJson}')"><i class="fas fa-edit"></i> แก้ไข</button>` : '-'}</td>
                    </tr>
                `;
            });
        }
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
            document.getElementById('form-verifier').value = '';
        } else {
            document.getElementById('modal-title').innerText = "เพิ่มรายการยาใหม่";
            ['item-id', 'drug-name', 'lot', 'qty', 'exp', 'verifier'].forEach(id => document.getElementById('form-' + id).value = '');
            document.getElementById('form-storage').value = 'ในกล่อง (In Box)';
            document.getElementById('form-unit-display').innerText = '';
            document.getElementById('form-is-opened').checked = false;
        }
    },

    closeModal() { document.getElementById('modal-drug').style.display = 'none'; },

    async saveDrug() {
        const payload = {
            action: 'save_drug',
            itemID: document.getElementById('form-item-id').value,
            boxId: this.currentBoxId, boxType: this.currentBoxType, department: this.currentBoxDept,
            drugName: document.getElementById('form-drug-name').value,
            lotNumber: document.getElementById('form-lot').value,
            qty: document.getElementById('form-qty').value,
            storageLoc: document.getElementById('form-storage').value,
            expireDate: document.getElementById('form-exp').value,
            isOpened: document.getElementById('form-is-opened').checked,
            status: 'Active', username: this.user.username,
            verifiedBy: document.getElementById('form-verifier').value
        };

        if (!payload.drugName || (!payload.expireDate && !payload.isOpened) || !payload.verifiedBy) {
            return alert("กรุณากรอก ชื่อยา, วันหมดอายุ และ ชื่อเภสัชกร");
        }

        const res = await this.callAPI(payload);
        if (res && res.status === 'success') {
            alert(res.message);
            this.closeModal();
            this.openBoxDetail(this.currentBoxId, this.currentBoxDept, this.currentBoxType);
        } else alert('เกิดข้อผิดพลาด: ' + (res ? res.message : 'ไม่ทราบสาเหตุ'));
    },

    async doStockTake() {
        const confirmTake = confirm("คุณยืนยันว่าได้ตรวจสอบ รายการยา, จำนวน และวันหมดอายุ ในกล่องว่าถูกต้องตรงกับหน้างานจริงแล้วใช่หรือไม่?");
        if (!confirmTake) return;
        const res = await this.callAPI({ action: 'stock_take', boxType: this.currentBoxType, department: this.currentBoxDept, username: this.user.username });
        if (res && res.status === 'success') {
            alert(res.message);
            this.loadDashboard();
        } else alert('เกิดข้อผิดพลาด: ' + (res ? res.message : 'ไม่สามารถเชื่อมต่อได้'));
    }
};

window.onload = () => app.init();

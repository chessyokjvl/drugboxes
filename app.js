const API_URL = 'https://script.google.com/macros/s/AKfycbwIbf8w_VSw5pCJXnUGtRgut8beeqG3wx2qkGbrU9fOHiaxbM5WA07FFBrZsbzxc3E3/exec';
const WARD_ORDER = ['พุทธรักษา', 'จำปาทอง', 'ราชาวดี', 'ลีลาวดี', 'ฉัตรชบา', 'ECT', 'ER'];
const app = {
    user: null, currentBoxId: null, currentBoxDept: null, currentBoxType: null, currentBoxName: null, currentBoxStatus: null,
    masterData: { departments: [], drugs: [] },
    tomSelectInstance: null,
    apiActiveCount: 0, // ตัวนับจำนวน API ที่กำลังโหลด

    async init() {
        // 🚀 โหลด Master Data ทิ้งไว้เบื้องหลัง (ไม่ต้องใส่ await เพื่อไม่ให้บล็อกหน้าเว็บ)
        this.loadMasterData();

        const userStr = localStorage.getItem('rxUser');
        if (userStr) {
            this.user = JSON.parse(userStr);
            this.showMainApp();
            // รอแค่ข้อมูล Dashboard ก็พอ
            await this.loadDashboardData();
        } else {
            this.navigateAuth('page-login');
        }
    },

    // ... (ฟังก์ชัน navigateAuth, showMainApp, navigateMenu, toggleSidebar เหมือนเดิม) ...

    showLoader(show) { 
        document.getElementById('loader').style.display = show ? 'flex' : 'none'; 
    },

    // 🚀 ปรับปรุงระบบ API ให้รองรับการยิงหลายเส้นพร้อมกันโดยที่ตัวหมุนไม่กระพริบ
    async callAPI(payload) {
        this.apiActiveCount++;
        this.showLoader(true);
        try {
            const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
            const data = await res.json();
            this.apiActiveCount--;
            if (this.apiActiveCount === 0) this.showLoader(false);
            return data;
        } catch (err) {
            this.apiActiveCount--;
            if (this.apiActiveCount === 0) this.showLoader(false);
            alert('การเชื่อมต่อขัดข้อง หรือ URL API ไม่ถูกต้อง');
        }
    },

    // ... (ฟังก์ชัน loadMasterData, showDrugInfo, login, register, forgotPassword, logout เหมือนเดิม) ...

    // 🚀 ปรับให้โหลดกล่องยา และ ประวัติ Logs ทำงาน "พร้อมกัน"
    async loadDashboardData() {
        // ใช้ Promise.all เพื่อยิง 2 API พร้อมกัน ประหยัดเวลาไปได้ครึ่งนึง!
        const [dashRes, logRes] = await Promise.all([
            this.callAPI({ action: 'get_dashboard' }),
            this.callAPI({ action: 'get_recent_logs' })
        ]);

        // 1. จัดการข้อมูล Dashboard
        if (dashRes && dashRes.status === 'success') {
            let totalBoxes = 0, totalDrugs = 0, exp3m = 0;
            const container = document.getElementById('ward-grid-container');
            container.innerHTML = '';

            const sortedBoxes = dashRes.data.sort((a, b) => {
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

        // 2. จัดการข้อมูล Logs
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

const API_URL = 'https://script.google.com/macros/s/AKfycbwIbf8w_VSw5pCJXnUGtRgut8beeqG3wx2qkGbrU9fOHiaxbM5WA07FFBrZsbzxc3E3/exec';
// ลำดับการแสดงผล Ward ที่ต้องการ (ตัวที่ไม่อยู่ใน List นี้จะถูกต่อท้าย)
const WARD_ORDER = ['พุทธรักษา', 'จำปาทอง', 'ราชาวดี', 'ลีลาวดี', 'ฉัตรชบา', 'ECT', 'ER'];

const app = {
    user: null, currentBoxId: null, currentBoxDept: null, currentBoxType: null, currentBoxName: null,
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

    // ================== UI Navigation ==================
    navigateAuth(pageId) {
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('auth-container').style.display = 'block';
        document.querySelectorAll('#auth-container .page').forEach(el => el.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
    },

    showMainApp() {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        document.getElementById('user-display').innerText = `${this.user.username} (${this.user.role})`;
    },

    navigateMenu(pageId, menuItem = null) {
        // จัดการ CSS หน้าต่าง
        document.querySelectorAll('main .page').forEach(el => el.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        
        // จัดการ CSS เมนูแถบซ้าย
        if (menuItem) {
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            menuItem.classList.add('active');
        }
        
        // ปิด Sidebar มือถืออัตโนมัติเมื่อกดเมนู
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
            alert('การเชื่อมต่อขัดข้อง');
        }
    },

    // ================== Data Loading ==================
    async loadMasterData() {
        const res = await this.callAPI({ action: 'get_master_data' });
        if (res && res.status === 'success') {
            this.masterData = res;
            // (ละโค้ดเติม dropdown ปกติไว้ เพื่อความสั้น)
            const deptSelect = document.getElementById('reg-dept');
            if (deptSelect) { res.departments.forEach(d => deptSelect.innerHTML += `<option value="${d}">${d}</option>`); }
            
            const drugList = document.getElementById('drug-master-list');
            if (drugList) { res.drugs.forEach(d => drugList.innerHTML += `<option value="${d.name}">`); }

            const searchSelect = document.getElementById('search-drug-info');
            if (searchSelect) {
                res.drugs.forEach(d => searchSelect.innerHTML += `<option value="${d.name}">${d.name}</option>`);
                this.tomSelectInstance = new TomSelect("#search-drug-info", { create: false, onChange: (v) => this.showDrugInfo(v) });
            }
        }
    },

    showDrugInfo(drugName) { /* (ใช้โค้ด Dictionary แบบเดิมที่ผมให้ไปรอบก่อนได้เลยครับ) */ },

    // ================== Dashboard & Wards ==================
    async loadDashboardData() {
        const res = await this.callAPI({ action: 'get_dashboard' });
        if (res && res.status === 'success') {
            let totalBoxes = 0, totalDrugs = 0, exp3m = 0, exp6m = 0;
            const container = document.getElementById('ward-grid-container');
            container.innerHTML = '';

            // 1. จัดเรียงข้อมูล (Custom Sorting ตาม Array WARD_ORDER)
            const sortedBoxes = res.data.sort((a, b) => {
                let indexA = WARD_ORDER.indexOf(a.department);
                let indexB = WARD_ORDER.indexOf(b.department);
                // ถ้าไม่เจอใน List ให้ไปอยู่ท้ายสุด
                if(indexA === -1) indexA = 999; 
                if(indexB === -1) indexB = 999;
                return indexA - indexB;
            });

            // 2. วาดกล่อง Grid & คำนวณสถิติ
            sortedBoxes.forEach(box => {
                totalBoxes++;
                totalDrugs += box.totalDrugs;
                exp3m += box.expiringSoon; // สมมติว่าใน API คืนค่ามาเป็น 3m
                // (ถ้าจะดึง 6 เดือนเป๊ะๆ ต้องแก้ backend หรือโหลด Inventory ทั้งก้อนมานับที่หน้าบ้านครับ)
                
                const isWarning = box.expiringSoon > 0;
                const card = document.createElement('div');
                card.className = `box-card ${isWarning ? 'warning' : ''}`;
                card.innerHTML = `
                    <div class="box-title">${box.boxName}</div>
                    <div style="font-size: 0.85rem; color: #666; margin-bottom: 10px;">${box.department} (${box.boxType})</div>
                    <div style="font-size: 0.9rem; border-top: 1px solid #eee; padding-top: 10px;">
                        รายการยา: <b>${box.totalDrugs}</b><br>
                        ${isWarning ? `<span style="color:var(--danger);">ใกล้หมดอายุ: ${box.expiringSoon}</span>` : `<span style="color:var(--primary-green);">สถานะปกติ</span>`}
                    </div>
                `;
                card.onclick = () => this.openBoxDetail(box.id, box.department, box.boxType, box.boxName);
                container.appendChild(card);
            });

            // อัปเดตตัวเลขหน้า Dashboard
            document.getElementById('stat-total-boxes').innerText = totalBoxes;
            document.getElementById('stat-total-drugs').innerText = totalDrugs;
            document.getElementById('stat-exp-3m').innerText = exp3m;
        }

        // โหลดประวัติ Logs
        const logRes = await this.callAPI({ action: 'get_recent_logs' });
        if (logRes && logRes.status === 'success') {
            const tbody = document.getElementById('dashboard-logs-tbody');
            tbody.innerHTML = '';
            logRes.data.forEach(log => {
                tbody.innerHTML += `<tr><td style="font-size:0.85rem;">${log.timestamp}</td><td><span style="background:var(--primary-green); color:white; padding:3px 6px; border-radius:4px; font-size:0.8rem;">${log.action}</span></td><td>${log.details}</td><td>${log.user}</td></tr>`;
            });
        }
    },

    // ================== Box Management (เหมือนเดิม) ==================
    async openBoxDetail(boxId, dept, type, boxName) {
        this.currentBoxId = boxId; this.currentBoxDept = dept; this.currentBoxType = type; this.currentBoxName = boxName;
        document.getElementById('detail-title').innerText = `${boxName} (${dept})`;
        document.getElementById('print-dept-name').innerText = dept; document.getElementById('print-box-name').innerText = boxName;
        
        this.navigateMenu('page-box-detail'); // สลับไปหน้าที่ไม่มีในเมนูซ้าย

        const res = await this.callAPI({ action: 'get_box_detail', boxId: boxId });
        if (res && res.status === 'success') {
            const tbody = document.getElementById('detail-tbody');
            tbody.innerHTML = '';
            res.data.forEach(item => {
                const itemJson = encodeURIComponent(JSON.stringify(item));
                tbody.innerHTML += `<tr><td>${item.drugName}</td><td>${item.lotNumber}</td><td>${item.storageLoc}</td><td>${item.expireDate}</td><td>${item.qty}</td><td><button class="btn-outline no-print" onclick="app.openDrugModal('${itemJson}')">แก้ไข</button></td></tr>`;
            });
        }
    },

    // (ฟังก์ชัน Auth และ SaveDrug ลากของเดิมมาใส่ได้เลยครับ)
    async login() { /* โค้ด login เดิม */ },
    logout() { localStorage.removeItem('rxUser'); this.navigateAuth('page-login'); },
    openDrugModal() { document.getElementById('modal-drug').style.display = 'flex'; },
    closeModal() { document.getElementById('modal-drug').style.display = 'none'; },
    async saveDrug() { /* โค้ด saveDrug เดิม */ }
};

window.onload = () => app.init();

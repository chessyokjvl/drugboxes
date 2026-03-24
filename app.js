const API_URL = 'https://script.google.com/macros/s/AKfycbwIbf8w_VSw5pCJXnUGtRgut8beeqG3wx2qkGbrU9fOHiaxbM5WA07FFBrZsbzxc3E3/exec';
const WARD_ORDER = ['พุทธรักษา', 'จำปาทอง', 'ราชาวดี', 'ลีลาวดี', 'ฉัตรชบา', 'ECT', 'ER'];
const app = {
    user: null, currentBoxId: null, currentBoxDept: null, currentBoxType: null, currentBoxName: null, currentBoxStatus: null,
    masterData: { departments: [], drugs: [] },
    allBoxes: [],
    tomSelectInstance: null,
    apiActiveCount: 0,
    currentReturnPage: 'page-box-detail', 
    currentFilterType: 'all',
    
    // ตัวแปรกราฟ
    chartStatusObj: null,
    chartWardExpObj: null,
    chartTopDrugsObj: null,

    async init() {
        this.loadMasterData(); 
        const userStr = localStorage.getItem('rxUser');
        if (userStr) {
            this.user = JSON.parse(userStr);
            this.showMainApp();
            await this.loadDashboardData();
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
        const drugInfo = typeof DRUG_DICTIONARY !== 'undefined' ? DRUG_DICTIONARY[drugName] : null;
        document.getElementById('info-drug-name').innerText = drugName;
        if (drugInfo) {
            document.getElementById('info-drug-unit').innerText = drugInfo.unit || '-';
            document.getElementById('info-drug-prep').innerHTML = drugInfo.prep || 'ไม่มีข้อมูล';
            document.getElementById('info-drug-admin').innerHTML = drugInfo.admin || 'ไม่มีข้อมูล';
            document.getElementById('info-drug-precautions').innerHTML = drugInfo.precautions || 'ไม่มีข้อมูล';
        } else {
            document.getElementById('info-drug-unit').innerText = '-';
            document.getElementById('info-drug-prep').innerHTML = '<span style="color:#999;"><i>ไม่มีข้อมูลการเตรียมยา</i></span>';
            document.getElementById('info-drug-admin').innerHTML = '<span style="color:#999;"><i>ไม่มีข้อมูลการบริหารยา</i></span>';
            document.getElementById('info-drug-precautions').innerHTML = '<span style="color:#999;"><i>ไม่มีข้อมูลข้อควรระวัง</i></span>';
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
        const pdpa = document.getElementById('reg-pdpa').checked;
        if (!u || !p || !e) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        if (!pdpa) return alert("กรุณากดยอมรับเงื่อนไข PDPA ก่อนสมัครใช้งาน"); 

        const res = await this.callAPI({ action: 'register', username: u, password: p, email: e, role: 'User', department: d, pdpaConsent: 'Accepted' });
        if (res && res.status === 'success') {
            alert("ลงทะเบียนสำเร็จ กรุณาเข้าสู่ระบบ");
            this.navigateAuth('page-login');
            ['reg-username', 'reg-password', 'reg-email'].forEach(id => document.getElementById(id).value = '');
            document.getElementById('reg-pdpa').checked = false;
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
        const [dashRes, logRes] = await Promise.all([
            this.callAPI({ action: 'get_dashboard' }),
            this.callAPI({ action: 'get_recent_logs' })
        ]);

        if (dashRes && dashRes.status === 'success') {
            this.allBoxes = dashRes.data;
            let totalBoxes = 0, totalDrugs = 0, exp3m = 0;
            this.allBoxes.forEach(box => { totalBoxes++; totalDrugs += box.totalDrugs; exp3m += box.expiringSoon; });
            document.getElementById('stat-total-boxes').innerText = totalBoxes;
            document.getElementById('stat-total-drugs').innerText = totalDrugs;
            document.getElementById('stat-exp-3m').innerText = exp3m;
            this.setupFilters();
            this.filterWards();
        }

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

    setupFilters() {
        const deptFilter = document.getElementById('filter-dept');
        const typeFilter = document.getElementById('filter-type');
        const currentDept = deptFilter.value;
        const currentType = typeFilter.value;
        const uniqueTypes = [...new Set(this.allBoxes.map(b => b.boxType))].filter(Boolean);
        
        deptFilter.innerHTML = '<option value="all">-- ทุกหน่วยงาน --</option>';
        if (this.masterData && this.masterData.departments) {
            this.masterData.departments.forEach(dept => deptFilter.innerHTML += `<option value="${dept}">${dept}</option>`);
        }
        typeFilter.innerHTML = '<option value="all">-- ทุกประเภท --</option>';
        uniqueTypes.forEach(type => typeFilter.innerHTML += `<option value="${type}">${type}</option>`);

        if (currentDept) deptFilter.value = currentDept;
        if (currentType) typeFilter.value = currentType;
    },

    filterWards() {
        const deptVal = document.getElementById('filter-dept').value;
        const typeVal = document.getElementById('filter-type').value;

        let filteredBoxes = this.allBoxes.filter(box => {
            return (deptVal === 'all' || box.department === deptVal) && (typeVal === 'all' || box.boxType === typeVal);
        });

        filteredBoxes.sort((a, b) => {
            let indexA = WARD_ORDER.indexOf(a.department);
            let indexB = WARD_ORDER.indexOf(b.department);
            if(indexA === -1) indexA = 999; if(indexB === -1) indexB = 999;
            return indexA - indexB;
        });

        const container = document.getElementById('ward-grid-container');
        container.innerHTML = '';

        if (filteredBoxes.length === 0) {
            container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #999; background: var(--white); border-radius: 12px;">ไม่พบกล่องยาที่ตรงกับเงื่อนไข</div>';
            return;
        }

        filteredBoxes.forEach(box => {
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
    },

    resetFilters() {
        document.getElementById('filter-dept').value = 'all';
        document.getElementById('filter-type').value = 'all';
        this.filterWards();
    },

    async openBoxDetail(boxId, dept, type, boxName, boxStatus) {
        this.currentReturnPage = 'page-box-detail'; 
        this.currentBoxId = boxId; this.currentBoxDept = dept; this.currentBoxType = type; this.currentBoxName = boxName; this.currentBoxStatus = boxStatus;
        
        const isPharmacy = (this.user.role === 'God Admin' || this.user.role === 'Admin' || this.user.dept === 'กลุ่มงานเภสัชกรรม');
        const isOwner = (this.user.dept === dept);
        const canEdit = isPharmacy || isOwner;

        document.getElementById('detail-title').innerText = `${boxName} (${type})`;
        document.getElementById('print-dept-name').innerText = dept;
        document.getElementById('print-box-name').innerText = boxName;
        
        this.navigateMenu('page-box-detail');
        
        document.getElementById('btn-add-drug').style.display = canEdit ? 'block' : 'none';
        document.getElementById('btn-send-pharma').style.display = (!isPharmacy && isOwner && boxStatus !== 'ส่งปรับแก้') ? 'block' : 'none';
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
                
                let actionButtons = '-';
                if (canEdit) {
                    // 📌 ถ้าเป็นยาพ่น (Salbutamol) หรือชื่อมีคำว่า Nebule ให้เพิ่มปุ่มแกะซอง
                    let openPkgBtn = '';
                    if (item.drugName.toLowerCase().includes('salbutamol') || item.drugName.toLowerCase().includes('nebule')) {
                        openPkgBtn = `<button class="btn-outline no-print" style="margin-right:5px; border-color:#e67e22; color:#e67e22;" onclick="app.openPackage('${item.itemID}', '${item.drugName}')" title="แกะซอง (คำนวณอายุ 3 เดือน)"><i class="fas fa-cut"></i></button>`;
                    }

                    actionButtons = `
                        ${openPkgBtn}
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

    // 📌 ฟังก์ชันแกะซองยา
    async openPackage(itemId, drugName) {
        const today = new Date().toISOString().split('T')[0];
        const openDateStr = prompt(`ระบุ "วันที่แกะซอง" สำหรับ ${drugName}\n(รูปแบบ ค.ศ.-เดือน-วัน เช่น ${today})\n\nระบบจะปรับวันหมดอายุใหม่เป็น 3 เดือนนับจากวันที่ระบุ`, today);
        
        if (!openDateStr) return; // กดยกเลิก
        
        const res = await this.callAPI({ action: 'open_package', itemID: itemId, drugName: drugName, openDate: openDateStr, username: this.user.username });
        if (res && res.status === 'success') {
            alert(res.message);
            // 📌 เช็คว่าแก้ไขมาจากหน้าไหน ให้กลับไปหน้านั้น
            if (this.currentReturnPage === 'page-filtered-list') {
                this.showFilteredList(this.currentFilterType);
            } else {
                this.openBoxDetail(this.currentBoxId, this.currentBoxDept, this.currentBoxType, this.currentBoxName, this.currentBoxStatus);
            }
        } else alert('เกิดข้อผิดพลาดในการบันทึก');
    },

    async showFilteredList(filterType) {
        this.currentReturnPage = 'page-filtered-list'; 
        this.currentFilterType = filterType; 
        
        document.getElementById('filtered-list-title').innerText = filterType === 'expiring' ? 'รายการยาใกล้หมดอายุ (ภายใน 3 เดือน)' : 'รายการยาทั้งหมดในระบบ';
        this.navigateMenu('page-filtered-list');

        const res = await this.callAPI({ action: 'get_all_inventory' });
        if (res && res.status === 'success') {
            const tbody = document.getElementById('filtered-tbody');
            tbody.innerHTML = '';
            
            const threeMonths = new Date();
            threeMonths.setDate(new Date().getDate() + 90);

            let displayData = res.data;
            if (filterType === 'expiring') {
                displayData = res.data.filter(item => new Date(item.expireDate) <= threeMonths);
            }

            displayData.sort((a, b) => a.drugName.localeCompare(b.drugName));

            if (displayData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">ไม่พบข้อมูล</td></tr>';
                return;
            }

            const isPharmacy = (this.user.role === 'God Admin' || this.user.role === 'Admin' || this.user.dept === 'กลุ่มงานเภสัชกรรม');

            displayData.forEach(item => {
                const expDate = new Date(item.expireDate);
                const isExpiring = expDate <= threeMonths;
                const itemJson = encodeURIComponent(JSON.stringify(item));
                const isOwner = (this.user.dept === item.department);
                const canEdit = isPharmacy || isOwner;

                let actionBtn = '-';
                if(canEdit) {
                    let openPkgBtn = '';
                    if (item.drugName.toLowerCase().includes('salbutamol') || item.drugName.toLowerCase().includes('nebule')) {
                        openPkgBtn = `<button class="btn-outline no-print" style="margin-right:5px; border-color:#e67e22; color:#e67e22;" onclick="app.openPackage('${item.itemID}', '${item.drugName}')" title="แกะซอง (คำนวณอายุ 3 เดือน)"><i class="fas fa-cut"></i></button>`;
                    }
                    actionBtn = `
                        ${openPkgBtn}
                        <button class="btn-outline no-print" onclick="app.openDrugModalFromGlobal('${itemJson}')" title="แก้ไขรายการ"><i class="fas fa-edit"></i></button>
                    `;
                }

                tbody.innerHTML += `
                    <tr>
                        <td><b style="color:var(--primary-green);">${item.department}</b><br><span style="font-size:0.8rem; color:#666;">${item.boxName}</span></td>
                        <td><b style="font-weight: 500;">${item.drugName}</b></td>
                        <td>${item.lotNumber}</td>
                        <td class="${isExpiring ? 'exp-warning' : ''}">${item.expireDate} ${isExpiring ? '⚠️' : ''}</td>
                        <td>${item.qty}</td>
                        <td><span style="font-size:0.8rem; background:#eee; padding:2px 6px; border-radius:4px;">${item.storageLoc || 'ในกล่อง'}</span></td>
                        <td class="no-print" style="white-space:nowrap;">${actionBtn}</td>
                    </tr>
                `;
            });
        }
    },

    openDrugModalFromGlobal(itemJsonEncoded) {
        const item = JSON.parse(decodeURIComponent(itemJsonEncoded));
        this.currentBoxId = item.department + '_' + item.boxName; 
        this.currentBoxDept = item.department;
        this.currentBoxType = item.boxType;
        this.currentBoxName = item.boxName;
        this.openDrugModal(itemJsonEncoded);
    },

    async verifyItem(itemId) {
        const res = await this.callAPI({ action: 'verify_item', itemID: itemId, username: this.user.username });
        if (res && res.status === 'success') {
            this.openBoxDetail(this.currentBoxId, this.currentBoxDept, this.currentBoxType, this.currentBoxName, this.currentBoxStatus);
        } else alert('เกิดข้อผิดพลาดในการบันทึก');
    },

    async updateBoxStatus(status) {
        let confirmMsg = status === 'ส่งปรับแก้' ? "ต้องการส่งกล่องนี้ให้ฝ่ายเภสัชกรรมปรับแก้ใช่หรือไม่?" : "ยืนยันการเคลียร์สถานะว่าปรับแก้เรียบร้อยแล้ว?";
        if (!confirm(confirmMsg)) return;

        const res = await this.callAPI({ action: 'update_box_status', boxName: this.currentBoxName, department: this.currentBoxDept, status: status, username: this.user.username });
        if (res && res.status === 'success') {
            alert(res.message);
            this.loadDashboardData();
            this.navigateMenu('page-wards'); 
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
            document.getElementById('form-verifier').value = this.user.username; 
        } else {
            document.getElementById('modal-title').innerText = "เพิ่มรายการยาใหม่";
            ['item-id', 'drug-name', 'lot', 'qty', 'exp'].forEach(id => document.getElementById('form-' + id).value = '');
            document.getElementById('form-storage').value = 'ในกล่อง (In Box)';
            document.getElementById('form-unit-display').innerText = '';
            document.getElementById('form-verifier').value = this.user.username; 
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
            status: 'Active', username: this.user.username,
            verifiedBy: document.getElementById('form-verifier').value
        };

        if (!payload.drugName || !payload.expireDate || !payload.verifiedBy) return alert("กรุณากรอก ชื่อยา, วันหมดอายุ และ ชื่อผู้ตรวจสอบ");

        const res = await this.callAPI(payload);
        if (res && res.status === 'success') {
            alert(res.message);
            this.closeModal();
            if (this.currentReturnPage === 'page-filtered-list') {
                this.showFilteredList(this.currentFilterType);
            } else {
                this.openBoxDetail(this.currentBoxId, this.currentBoxDept, this.currentBoxType, this.currentBoxName, this.currentBoxStatus);
            }
        } else alert('เกิดข้อผิดพลาด: ' + (res ? res.message : 'ไม่ทราบสาเหตุ'));
    },

    // ==========================================
    // 📈 ระบบประมวลผล Analytics Dashboard (เมนูรายงาน)
    // ==========================================
    async openAnalytics(menuItem) {
        this.navigateMenu('page-analytics', menuItem);
        
        const res = await this.callAPI({ action: 'get_all_inventory' });
        if (res && res.status === 'success') {
            const data = res.data;
            
            const today = new Date();
            const threeMonths = new Date();
            threeMonths.setDate(today.getDate() + 90);

            // คำนวณ Chart 1: สัดส่วนความเสี่ยงยา
            let safeCount = 0, exp3mCount = 0, expiredCount = 0;
            data.forEach(item => {
                const expDate = new Date(item.expireDate);
                if (expDate < today) expiredCount++;
                else if (expDate <= threeMonths) exp3mCount++;
                else safeCount++;
            });

            // คำนวณ Chart 2: ยาใกล้หมดอายุแยกตามหอผู้ป่วย
            const wardExpMap = {};
            data.forEach(item => {
                const expDate = new Date(item.expireDate);
                if (expDate <= threeMonths) {
                    wardExpMap[item.department] = (wardExpMap[item.department] || 0) + 1;
                }
            });
            const wardLabels = Object.keys(wardExpMap);
            const wardData = Object.values(wardExpMap);

            // คำนวณ Chart 3: Top 5 รายการยา
            const drugCountMap = {};
            data.forEach(item => {
                drugCountMap[item.drugName] = (drugCountMap[item.drugName] || 0) + Number(item.qty);
            });
            const sortedDrugs = Object.entries(drugCountMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const topDrugLabels = sortedDrugs.map(d => d[0]);
            const topDrugData = sortedDrugs.map(d => d[1]);

            // วาดกราฟ (ทำลายกราฟเก่าทิ้งก่อนถ้ามี)
            if(this.chartStatusObj) this.chartStatusObj.destroy();
            if(this.chartWardExpObj) this.chartWardExpObj.destroy();
            if(this.chartTopDrugsObj) this.chartTopDrugsObj.destroy();

            const ctxStatus = document.getElementById('chart-status').getContext('2d');
            this.chartStatusObj = new Chart(ctxStatus, {
                type: 'doughnut',
                data: {
                    labels: ['ปกติ', 'หมดอายุ < 3 เดือน', 'หมดอายุแล้ว'],
                    datasets: [{
                        data: [safeCount, exp3mCount, expiredCount],
                        backgroundColor: ['#2ecc71', '#f39c12', '#e74c3c'],
                        borderWidth: 0
                    }]
                },
                options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
            });

            const ctxWardExp = document.getElementById('chart-ward-exp').getContext('2d');
            this.chartWardExpObj = new Chart(ctxWardExp, {
                type: 'bar',
                data: {
                    labels: wardLabels.length > 0 ? wardLabels : ['ไม่มีข้อมูล'],
                    datasets: [{
                        label: 'จำนวนยาเสี่ยง (รายการ)',
                        data: wardData.length > 0 ? wardData : [0],
                        backgroundColor: '#e74c3c',
                        borderRadius: 4
                    }]
                },
                options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
            });

            const ctxTopDrugs = document.getElementById('chart-top-drugs').getContext('2d');
            this.chartTopDrugsObj = new Chart(ctxTopDrugs, {
                type: 'bar',
                data: {
                    labels: topDrugLabels,
                    datasets: [{
                        label: 'จำนวนรวมทั้งหมด (ชิ้น)',
                        data: topDrugData,
                        backgroundColor: '#3498db',
                        borderRadius: 4
                    }]
                },
                options: { indexAxis: 'y', maintainAspectRatio: false }
            });
        }
    }
};

window.onload = () => app.init();

const API_URL = 'https://script.google.com/macros/s/AKfycbwIbf8w_VSw5pCJXnUGtRgut8beeqG3wx2qkGbrU9fOHiaxbM5WA07FFBrZsbzxc3E3/exec';
const WARD_ORDER = ['พุทธรักษา', 'จำปาทอง', 'ราชาวดี', 'ลีลาวดี', 'ฉัตรชบา', 'ECT', 'ER'];
const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

const app = {
    user: null, currentBoxId: null, currentBoxDept: null, currentBoxType: null, currentBoxName: null, currentBoxStatus: null,
    masterData: { departments: [], drugs: [] },
    allInventory: [], 
    allBoxes: [],     
    tomSelectInstance: null,
    apiActiveCount: 0,
    currentReturnPage: 'page-box-detail', 
    currentFilterType: 'all',
    
    currentGlobalData: [],
    sortConfig: { column: null, asc: true },

    calMonth: new Date().getMonth(),
    calYear: new Date().getFullYear(),
    chartStatusObj: null, chartWardExpObj: null, chartTopDrugsObj: null,

    async init() {
        this.loadMasterData(); 
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
        document.getElementById('user-display').innerText = `${this.user.username}`;
        this.setupCalendarSelectors();
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
            Swal.fire({ icon: 'error', title: 'ข้อผิดพลาดเครือข่าย', text: 'การเชื่อมต่อขัดข้อง' });
        }
    },

    getWardBadgeStyle(deptName) {
        if (deptName.includes('พุทธรักษา')) return 'background-color: #7f8c8d; color: white;'; 
        if (deptName.includes('จำปาทอง')) return 'background-color: #27ae60; color: white;'; 
        if (deptName.includes('ราชาวดี')) return 'background-color: #2980b9; color: white;'; 
        if (deptName.includes('ลีลาวดี')) return 'background-color: #fd79a8; color: white;'; 
        if (deptName.includes('ER') || deptName.includes('ฉุกเฉิน')) return 'background-color: #c0392b; color: white;'; 
        if (deptName.includes('ECT')) return 'background-color: #e67e22; color: white;'; 
        return 'background-color: #34495e; color: white;'; 
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
                    document.getElementById('form-unit-display').innerText = (selectedDrug && selectedDrug.unit) ? `(${selectedDrug.unit})` : '';
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
            document.getElementById('info-drug-prep').innerHTML = '<span style="color:#999;"><i>ไม่มีข้อมูล</i></span>';
            document.getElementById('info-drug-admin').innerHTML = '<span style="color:#999;"><i>ไม่มีข้อมูล</i></span>';
            document.getElementById('info-drug-precautions').innerHTML = '<span style="color:#999;"><i>ไม่มีข้อมูล</i></span>';
        }
        displayDiv.style.display = 'block';
    },

    async login() {
        const u = document.getElementById('login-username').value;
        const p = document.getElementById('login-password').value;
        if (!u || !p) return Swal.fire({ icon: 'warning', text: "กรุณากรอก Username และ Password" });
        const res = await this.callAPI({ action: 'login', username: u, password: p });
        if (res && res.status === 'success') {
            this.user = res.user;
            localStorage.setItem('rxUser', JSON.stringify(res.user));
            Swal.fire({ icon: 'success', title: 'เข้าสู่ระบบสำเร็จ', showConfirmButton: false, timer: 1200 });
            this.showMainApp();
            this.loadDashboardData();
        } else Swal.fire({ icon: 'error', title: 'เข้าสู่ระบบล้มเหลว', text: res ? res.message : '' });
    },

    async register() {
        const u = document.getElementById('reg-username').value;
        const p = document.getElementById('reg-password').value;
        const e = document.getElementById('reg-email').value;
        const d = document.getElementById('reg-dept').value;
        const pdpa = document.getElementById('reg-pdpa').checked;
        if (!u || !p || !e) return Swal.fire({ icon: 'warning', text: "กรุณากรอกให้ครบถ้วน" });
        if (!pdpa) return Swal.fire({ icon: 'warning', title: 'PDPA', text: "กรุณายอมรับเงื่อนไข" }); 
        const res = await this.callAPI({ action: 'register', username: u, password: p, email: e, role: 'User', department: d, pdpaConsent: 'Accepted' });
        if (res && res.status === 'success') {
            Swal.fire({ icon: 'success', title: 'ลงทะเบียนสำเร็จ', text: "กรุณาเข้าสู่ระบบ" });
            this.navigateAuth('page-login');
            ['reg-username', 'reg-password', 'reg-email'].forEach(id => document.getElementById(id).value = '');
            document.getElementById('reg-pdpa').checked = false;
        } else Swal.fire({ icon: 'error', text: res ? res.message : '' });
    },

    async forgotPassword() {
        const e = document.getElementById('forgot-email').value;
        if (!e) return Swal.fire({ icon: 'warning', text: "กรุณากรอก E-mail" });
        const res = await this.callAPI({ action: 'reset_password', email: e });
        if (res && res.status === 'success') {
            Swal.fire({ icon: 'success', title: 'ส่งรหัสผ่านแล้ว', text: res.message });
            this.navigateAuth('page-login');
            document.getElementById('forgot-email').value = '';
        } else Swal.fire({ icon: 'error', text: res ? res.message : 'ไม่พบ E-mail นี้' });
    },

    logout() {
        localStorage.removeItem('rxUser');
        this.user = null;
        this.navigateAuth('page-login');
    },

    async loadDashboardData() {
        const [dashRes, logRes, invRes] = await Promise.all([
            this.callAPI({ action: 'get_dashboard' }),
            this.callAPI({ action: 'get_recent_logs' }),
            this.callAPI({ action: 'get_all_inventory' })
        ]);

        if (invRes && invRes.status === 'success') {
            this.allInventory = invRes.data;
            const today = new Date(); today.setHours(0,0,0,0);
            const threeMonths = new Date(today); threeMonths.setDate(today.getDate() + 90);
            const sixMonths = new Date(today); sixMonths.setDate(today.getDate() + 180);

            let totalDrugs = 0, expired = 0, exp3m = 0, exp6m = 0;
            this.allInventory.forEach(item => {
                totalDrugs += Number(item.qty);
                const expDate = new Date(item.expireDate); expDate.setHours(0,0,0,0);
                if (expDate < today) expired++;
                else if (expDate <= threeMonths) exp3m++;
                else if (expDate <= sixMonths) exp6m++;
            });

            // 📌 เช็คก่อนว่ามี ID นี้ในหน้าเว็บไหม เพื่อป้องกัน Error จากการซ่อน/โชว์หน้า
            if(document.getElementById('stat-total-drugs')) {
                document.getElementById('stat-total-drugs').innerText = totalDrugs;
                document.getElementById('stat-expired').innerText = expired;
                document.getElementById('stat-exp-3m').innerText = exp3m;
                document.getElementById('stat-exp-6m').innerText = exp6m;
            }
        }

        if (dashRes && dashRes.status === 'success') {
            this.allBoxes = dashRes.data;
            if(document.getElementById('stat-total-boxes')) {
                document.getElementById('stat-total-boxes').innerText = this.allBoxes.length;
            }
            this.setupFilters();
            this.filterWards();
        }

        if (logRes && logRes.status === 'success') {
            const tbody = document.getElementById('dashboard-logs-tbody');
            if (tbody) {
                tbody.innerHTML = '';
                if (logRes.data.length === 0) tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">ยังไม่มีประวัติ</td></tr>';
                else logRes.data.forEach(log => {
                    const actColor = log.action === 'STATUS' ? '#3498db' : (log.action === 'INSERT' ? 'var(--primary-green)' : (log.action === 'STOCK_TAKE' ? '#27ae60' : '#f39c12'));
                    tbody.innerHTML += `<tr><td style="font-size: 0.85rem; color: #666;">${log.timestamp}</td><td><span style="background: ${actColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${log.action}</span></td><td>${log.details}</td><td style="font-weight: 500;">${log.user}</td></tr>`;
                });
            }
        }
    },

    setupFilters() {
        const deptFilter = document.getElementById('filter-dept');
        const typeFilter = document.getElementById('filter-type');
        if(!deptFilter || !typeFilter) return;

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
        const deptFilter = document.getElementById('filter-dept');
        const typeFilter = document.getElementById('filter-type');
        if(!deptFilter || !typeFilter) return;

        const deptVal = deptFilter.value;
        const typeVal = typeFilter.value;

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
        if(!container) return;
        container.innerHTML = '';

        if (filteredBoxes.length === 0) {
            container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #999;">ไม่พบกล่องยาที่ตรงกับเงื่อนไข</div>';
            return;
        }

        filteredBoxes.forEach(box => {
            let boxColorClass = 'box-ward'; 
            const typeStr = box.boxType.toLowerCase();
            if (typeStr.includes('cpr')) boxColorClass = 'box-cpr'; 
            else if (typeStr.includes('urgency')) boxColorClass = 'box-urgency'; 

            const isSent = (box.boxStatus === 'ส่งปรับแก้');
            const badgeStyle = this.getWardBadgeStyle(box.department);

            const card = document.createElement('div');
            card.className = `box-card ${boxColorClass}`;
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom: 5px;">
                    <div class="box-title">${box.boxName}</div>
                    ${isSent ? `<span style="background:var(--danger); color:white; padding:2px 6px; border-radius:4px; font-size:0.75rem;">รอเภสัชฯ</span>` : ''}
                </div>
                <div style="margin-bottom: 10px;"><span style="font-size: 0.8rem; padding: 3px 8px; border-radius: 4px; ${badgeStyle}">${box.department}</span></div>
                <div style="font-size: 0.85rem; border-top: 1px solid #eee; padding-top: 10px;">
                    รายการยาทั้งหมด: <b>${box.totalDrugs}</b><br>
                    <span style="color:#999; font-size:0.8rem;">(กดเพื่อจัดการ)</span>
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

            const today = new Date(); today.setHours(0,0,0,0);
            const threeMonths = new Date(today); threeMonths.setDate(today.getDate() + 90);
            const sixMonths = new Date(today); sixMonths.setDate(today.getDate() + 180);

            res.data.forEach(item => {
                const expDate = new Date(item.expireDate); expDate.setHours(0,0,0,0);
                
                let expLabel = ''; let textClass = '';
                if (expDate < today) { expLabel = '(หมดอายุ)'; textClass = 'color: var(--expired-black); font-weight:bold;'; }
                else if (expDate <= threeMonths) { expLabel = '⚠️(ใน 3 เดือน)'; textClass = 'color: var(--danger); font-weight:bold;'; }
                else if (expDate <= sixMonths) { expLabel = '⚠️(ใน 6 เดือน)'; textClass = 'color: var(--warning-orange); font-weight:bold;'; }

                const itemJson = encodeURIComponent(JSON.stringify(item));
                
                let actionButtons = '-';
                if (canEdit) {
                    let openPkgBtn = '';
                    if (item.drugName.toLowerCase().includes('salbutamol') || item.drugName.toLowerCase().includes('nebule')) {
                        openPkgBtn = `<button class="btn-outline no-print" style="margin-right:5px; border-color:#e67e22; color:#e67e22;" onclick="app.openPackage('${item.itemID}', '${item.drugName}')" title="แกะซอง (อายุ 3 เดือน)"><i class="fas fa-cut"></i></button>`;
                    }
                    actionButtons = `
                        ${openPkgBtn}
                        <button class="btn-outline no-print" style="margin-right:5px; border-color:#27ae60; color:#27ae60;" onclick="app.verifyItem('${item.itemID}')" title="ตรวจสอบว่าถูกต้อง"><i class="fas fa-check"></i></button>
                        <button class="btn-outline no-print" onclick="app.openDrugModal('${itemJson}')" title="แก้ไขรายการ"><i class="fas fa-edit"></i></button>
                    `;
                }
                
                tbody.innerHTML += `
                    <tr>
                        <td><b style="font-weight: 500;">${item.drugName}</b><br><span style="font-size:0.75rem; color:#999;">อัปเดต: ${new Date(item.lastUpdate).toLocaleDateString('th-TH')} | โดย: ${item.verifiedBy || '-'}</span></td>
                        <td>${item.lotNumber}</td>
                        <td><span style="font-size:0.85rem; color:var(--text-dark); background:#eee; padding:3px 8px; border-radius:4px;">${item.storageLoc || 'ในกล่อง'}</span></td>
                        <td style="${textClass}">${item.expireDate} ${expLabel}</td>
                        <td>${item.qty}</td>
                        <td class="no-print" style="white-space: nowrap;">${actionButtons}</td>
                    </tr>
                `;
            });
        }
    },

    showFilteredList(filterType) {
        this.currentReturnPage = 'page-filtered-list'; 
        this.currentFilterType = filterType; 
        
        let titleText = 'รายการยาทั้งหมดในระบบ';
        if (filterType === 'expired') titleText = 'รายการยาที่หมดอายุแล้ว (สีดำ)';
        else if (filterType === 'exp3m') titleText = 'รายการยาที่หมดอายุภายใน 3 เดือน (สีแดง)';
        else if (filterType === 'exp6m') titleText = 'รายการยาที่หมดอายุภายใน 3-6 เดือน (สีส้ม)';
        
        document.getElementById('filtered-list-title').innerText = titleText;
        document.getElementById('print-global-subtitle').innerText = titleText;
        this.navigateMenu('page-filtered-list');

        const today = new Date(); today.setHours(0,0,0,0);
        const threeMonths = new Date(today); threeMonths.setDate(today.getDate() + 90);
        const sixMonths = new Date(today); sixMonths.setDate(today.getDate() + 180);

        let displayData = [...this.allInventory];

        if (filterType === 'expired') {
            displayData = displayData.filter(item => { const d = new Date(item.expireDate); d.setHours(0,0,0,0); return d < today; });
        } else if (filterType === 'exp3m') {
            displayData = displayData.filter(item => { const d = new Date(item.expireDate); d.setHours(0,0,0,0); return d >= today && d <= threeMonths; });
        } else if (filterType === 'exp6m') {
            displayData = displayData.filter(item => { const d = new Date(item.expireDate); d.setHours(0,0,0,0); return d > threeMonths && d <= sixMonths; });
        }

        this.currentGlobalData = displayData;
        this.sortConfig = { column: 'expireDate', asc: true }; 
        this.renderGlobalTable(); 
    },

    renderGlobalTable() {
        const tbody = document.getElementById('filtered-tbody');
        tbody.innerHTML = '';
        if (this.currentGlobalData.length === 0) return tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">ไม่พบข้อมูล</td></tr>';

        this.currentGlobalData.sort((a, b) => {
            let valA = a[this.sortConfig.column] || '';
            let valB = b[this.sortConfig.column] || '';
            if (valA < valB) return this.sortConfig.asc ? -1 : 1;
            if (valA > valB) return this.sortConfig.asc ? 1 : -1;
            return 0;
        });

        const today = new Date(); today.setHours(0,0,0,0);
        const threeMonths = new Date(today); threeMonths.setDate(today.getDate() + 90);
        const sixMonths = new Date(today); sixMonths.setDate(today.getDate() + 180);
        const isPharmacy = (this.user.role === 'God Admin' || this.user.role === 'Admin' || this.user.dept === 'กลุ่มงานเภสัชกรรม');

        this.currentGlobalData.forEach(item => {
            const expDate = new Date(item.expireDate); expDate.setHours(0,0,0,0);
            let expLabel = ''; let textClass = '';
            
            if (expDate < today) { expLabel = '(หมดอายุ)'; textClass = 'color: var(--expired-black); font-weight:bold;'; }
            else if (expDate <= threeMonths) { expLabel = '⚠️(< 3 ด.)'; textClass = 'color: var(--danger); font-weight:bold;'; }
            else if (expDate <= sixMonths) { expLabel = '⚠️(< 6 ด.)'; textClass = 'color: var(--warning-orange); font-weight:bold;'; }

            const itemJson = encodeURIComponent(JSON.stringify(item));
            const isOwner = (this.user.dept === item.department);
            const canEdit = isPharmacy || isOwner;
            const badgeStyle = this.getWardBadgeStyle(item.department);

            let actionBtn = '-';
            if(canEdit) {
                let openPkgBtn = '';
                if (item.drugName.toLowerCase().includes('salbutamol') || item.drugName.toLowerCase().includes('nebule')) {
                    openPkgBtn = `<button class="btn-outline no-print" style="margin-right:5px; border-color:#e67e22; color:#e67e22;" onclick="app.openPackage('${item.itemID}', '${item.drugName}')" title="แกะซอง"><i class="fas fa-cut"></i></button>`;
                }
                actionBtn = `${openPkgBtn}<button class="btn-outline no-print" onclick="app.openDrugModalFromGlobal('${itemJson}')" title="แก้ไขรายการ"><i class="fas fa-edit"></i></button>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td><span style="font-size:0.8rem; padding:2px 6px; border-radius:4px; ${badgeStyle}">${item.department}</span><br><span style="font-size:0.8rem; color:#666;">${item.boxName}</span></td>
                    <td><b style="font-weight: 500;">${item.drugName}</b></td>
                    <td>${item.lotNumber}</td>
                    <td style="${textClass}">${item.expireDate} ${expLabel}</td>
                    <td>${item.qty}</td>
                    <td><span style="font-size:0.8rem; background:#eee; padding:2px 6px; border-radius:4px;">${item.storageLoc || 'ในกล่อง'}</span></td>
                    <td class="no-print" style="white-space:nowrap;">${actionBtn}</td>
                </tr>
            `;
        });
    },

    sortTable(columnName) {
        if (this.sortConfig.column === columnName) { this.sortConfig.asc = !this.sortConfig.asc; } 
        else { this.sortConfig.column = columnName; this.sortConfig.asc = true; }
        this.renderGlobalTable(); 
    },

    exportExcel(mode) {
        let exportData = mode === 'calendar' ? this.getCalendarData() : this.currentGlobalData;
        if (exportData.length === 0) return Swal.fire('ไม่มีข้อมูล', 'ไม่มีข้อมูลสำหรับ Export', 'info');
        
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
        csvContent += "หน่วยงาน,ชื่อกล่อง,ชื่อยา,Lot Number,วันหมดอายุ,จำนวน,แหล่งเก็บ\n";
        
        exportData.forEach(item => {
            csvContent += `"${item.department}","${item.boxName}","${item.drugName}","${item.lotNumber}","${item.expireDate}","${item.qty}","${item.storageLoc}"\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `รายงาน_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    setupCalendarSelectors() {
        const monthSelect = document.getElementById('cal-month');
        const yearSelect = document.getElementById('cal-year');
        if (!monthSelect || !yearSelect) return;
        
        monthSelect.innerHTML = '';
        THAI_MONTHS.forEach((m, i) => monthSelect.innerHTML += `<option value="${i}">${m}</option>`);
        
        yearSelect.innerHTML = '';
        const currentY = new Date().getFullYear();
        for (let y = currentY - 1; y <= currentY + 5; y++) yearSelect.innerHTML += `<option value="${y}">${y + 543}</option>`;
    },

    openCalendar(menuItem) {
        this.navigateMenu('page-calendar', menuItem);
        document.getElementById('cal-month').value = this.calMonth;
        document.getElementById('cal-year').value = this.calYear;
        this.renderCalendar();
    },

    changeMonth(step) {
        this.calMonth += step;
        if (this.calMonth < 0) { this.calMonth = 11; this.calYear--; }
        else if (this.calMonth > 11) { this.calMonth = 0; this.calYear++; }
        
        document.getElementById('cal-month').value = this.calMonth;
        document.getElementById('cal-year').value = this.calYear;
        this.renderCalendar();
    },

    renderCalendar() {
        this.calMonth = parseInt(document.getElementById('cal-month').value);
        this.calYear = parseInt(document.getElementById('cal-year').value);
        document.getElementById('print-cal-subtitle').innerText = `ประจำเดือน ${THAI_MONTHS[this.calMonth]} ${this.calYear + 543}`;

        const grid = document.querySelector('.calendar-grid');
        Array.from(grid.children).forEach(child => { if (!child.classList.contains('cal-header')) child.remove(); });

        const firstDay = new Date(this.calYear, this.calMonth, 1).getDay(); 
        const daysInMonth = new Date(this.calYear, this.calMonth + 1, 0).getDate(); 

        const monthItems = this.allInventory.filter(item => {
            const expD = new Date(item.expireDate);
            return expD.getMonth() === this.calMonth && expD.getFullYear() === this.calYear;
        });

        for (let i = 0; i < firstDay; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'cal-day empty';
            grid.appendChild(emptyDiv);
        }

        const todayDate = new Date();
        const todayReset = new Date(); todayReset.setHours(0,0,0,0);
        const threeMonths = new Date(todayReset); threeMonths.setDate(todayReset.getDate() + 90);
        const sixMonths = new Date(todayReset); sixMonths.setDate(todayReset.getDate() + 180);

        for (let day = 1; day <= daysInMonth; day++) {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'cal-day';
            
            const isToday = (day === todayDate.getDate() && this.calMonth === todayDate.getMonth() && this.calYear === todayDate.getFullYear());
            dayDiv.innerHTML = `<div class="cal-date ${isToday ? 'today' : ''}">${day}</div>`;

            const dayItems = monthItems.filter(item => new Date(item.expireDate).getDate() === day);
            
            dayItems.forEach(item => {
                const expDate = new Date(item.expireDate); expDate.setHours(0,0,0,0);
                let colorClass = '';
                if (expDate < todayReset) colorClass = 'expired';
                else if (expDate <= threeMonths) colorClass = 'exp3m';
                else if (expDate <= sixMonths) colorClass = 'exp6m';

                const itemJson = encodeURIComponent(JSON.stringify(item));
                const eventDiv = document.createElement('div');
                eventDiv.className = `cal-event ${colorClass}`;
                eventDiv.innerText = `${item.drugName} (${item.department})`;
                eventDiv.onclick = () => this.openDrugModalFromGlobal(itemJson); 
                dayDiv.appendChild(eventDiv);
            });
            grid.appendChild(dayDiv);
        }
    },

    getCalendarData() {
        return this.allInventory.filter(item => {
            const expD = new Date(item.expireDate);
            return expD.getMonth() === this.calMonth && expD.getFullYear() === this.calYear;
        });
    },

    printCalendar() {
        const style = document.getElementById('print-page-style');
        style.innerHTML = `@media print { @page { size: landscape; margin: 1cm; } }`;
        window.print();
        setTimeout(() => style.innerHTML = '', 1000); 
    },
    
    openDrugModalFromGlobal(itemJsonEncoded) {
        const item = JSON.parse(decodeURIComponent(itemJsonEncoded));
        this.currentBoxId = item.department + '_' + item.boxName; 
        this.currentBoxDept = item.department;
        this.currentBoxType = item.boxType;
        this.currentBoxName = item.boxName;
        
        if(document.getElementById('page-calendar').classList.contains('active')) this.currentReturnPage = 'page-calendar';
        
        this.openDrugModal(itemJsonEncoded);
    },

    async openPackage(itemId, drugName) {
        const today = new Date().toISOString().split('T')[0];
        const { value: openDateStr } = await Swal.fire({
            title: 'แกะซองยา', html: `ระบุ "วันที่แกะซอง" สำหรับ <b>${drugName}</b><br>ระบบจะปรับวันหมดอายุใหม่เป็น 3 เดือนนับจากวันที่ระบุ`,
            input: 'date', inputValue: today, showCancelButton: true, confirmButtonColor: '#e67e22', confirmButtonText: 'บันทึก (แกะซอง)', cancelButtonText: 'ยกเลิก'
        });
        
        if (!openDateStr) return;
        const res = await this.callAPI({ action: 'open_package', itemID: itemId, drugName: drugName, openDate: openDateStr, username: this.user.username });
        if (res && res.status === 'success') {
            Swal.fire({ icon: 'success', title: 'สำเร็จ!', text: res.message });
            this.handlePostSaveReturn(); 
        } else Swal.fire({ icon: 'error', text: 'เกิดข้อผิดพลาดในการบันทึก' });
    },

    async verifyItem(itemId) {
        const res = await this.callAPI({ action: 'verify_item', itemID: itemId, username: this.user.username });
        if (res && res.status === 'success') {
            Swal.fire({ icon: 'success', title: 'เยี่ยมมาก!', text: res.message, timer: 1500, showConfirmButton: false });
            this.handlePostSaveReturn();
        } else Swal.fire({ icon: 'error', text: 'ไม่สามารถบันทึกการตรวจสอบได้' });
    },

    async updateBoxStatus(status) {
        let confirmMsg = status === 'ส่งปรับแก้' ? "ต้องการส่งกล่องนี้ให้ฝ่ายเภสัชกรรมปรับแก้ใช่หรือไม่?" : "ยืนยันการเคลียร์สถานะว่าปรับแก้เรียบร้อยแล้ว?";
        const result = await Swal.fire({ title: 'ยืนยัน', text: confirmMsg, icon: 'warning', showCancelButton: true, confirmButtonColor: status === 'ส่งปรับแก้' ? '#e74c3c' : '#27ae60', confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก' });
        if (!result.isConfirmed) return;

        const res = await this.callAPI({ action: 'update_box_status', boxName: this.currentBoxName, department: this.currentBoxDept, status: status, username: this.user.username });
        if (res && res.status === 'success') {
            Swal.fire({ icon: 'success', text: res.message });
            this.loadDashboardData();
            this.navigateMenu('page-wards'); 
        } else Swal.fire({ icon: 'error', text: 'ไม่สามารถอัปเดตสถานะได้' });
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
            document.getElementById('form-verifier').value = this.user.username; 
        } else {
            document.getElementById('modal-title').innerText = "เพิ่มรายการยาใหม่";
            ['item-id', 'drug-name', 'lot', 'qty', 'exp'].forEach(id => document.getElementById('form-' + id).value = '');
            document.getElementById('form-storage').value = 'ในกล่อง (In Box)';
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

        if (!payload.drugName || !payload.expireDate || !payload.verifiedBy) return Swal.fire({ icon: 'warning', text: "กรุณากรอกให้ครบ" });

        const res = await this.callAPI(payload);
        if (res && res.status === 'success') {
            Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', text: res.message, timer: 1500, showConfirmButton: false });
            this.closeModal();
            this.handlePostSaveReturn(); 
        } else Swal.fire({ icon: 'error', text: res ? res.message : 'ไม่ทราบสาเหตุ' });
    },

    async handlePostSaveReturn() {
        const res = await this.callAPI({ action: 'get_all_inventory' });
        if (res && res.status === 'success') {
            this.allInventory = res.data;
            if (this.currentReturnPage === 'page-filtered-list') this.showFilteredList(this.currentFilterType);
            else if (this.currentReturnPage === 'page-calendar') this.renderCalendar();
            else this.openBoxDetail(this.currentBoxId, this.currentBoxDept, this.currentBoxType, this.currentBoxName, this.currentBoxStatus);
            this.loadDashboardData();
        }
    },

    async openAnalytics(menuItem) {
        this.navigateMenu('page-analytics', menuItem);
        const data = this.allInventory; 
        
        const today = new Date(); today.setHours(0,0,0,0);
        const threeMonths = new Date(today); threeMonths.setDate(today.getDate() + 90);

        let safeCount = 0, exp3mCount = 0, expiredCount = 0;
        data.forEach(item => {
            const expDate = new Date(item.expireDate); expDate.setHours(0,0,0,0);
            if (expDate < today) expiredCount++;
            else if (expDate <= threeMonths) exp3mCount++;
            else safeCount++;
        });

        const wardExpMap = {};
        data.forEach(item => {
            const expDate = new Date(item.expireDate); expDate.setHours(0,0,0,0);
            if (expDate <= threeMonths) wardExpMap[item.department] = (wardExpMap[item.department] || 0) + 1;
        });
        const wardLabels = Object.keys(wardExpMap); const wardData = Object.values(wardExpMap);

        const drugCountMap = {};
        data.forEach(item => { drugCountMap[item.drugName] = (drugCountMap[item.drugName] || 0) + Number(item.qty); });
        const sortedDrugs = Object.entries(drugCountMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const topDrugLabels = sortedDrugs.map(d => d[0]); const topDrugData = sortedDrugs.map(d => d[1]);

        if(this.chartStatusObj) this.chartStatusObj.destroy();
        if(this.chartWardExpObj) this.chartWardExpObj.destroy();
        if(this.chartTopDrugsObj) this.chartTopDrugsObj.destroy();

        const ctxStatus = document.getElementById('chart-status').getContext('2d');
        this.chartStatusObj = new Chart(ctxStatus, {
            type: 'doughnut', data: { labels: ['ปกติ', 'หมดอายุ < 3 เดือน', 'หมดอายุแล้ว'], datasets: [{ data: [safeCount, exp3mCount, expiredCount], backgroundColor: ['#2ecc71', '#f39c12', '#e74c3c'], borderWidth: 0 }] },
            options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });

        const ctxWardExp = document.getElementById('chart-ward-exp').getContext('2d');
        this.chartWardExpObj = new Chart(ctxWardExp, {
            type: 'bar', data: { labels: wardLabels.length > 0 ? wardLabels : ['ไม่มีข้อมูล'], datasets: [{ label: 'จำนวนยาเสี่ยง (รายการ)', data: wardData.length > 0 ? wardData : [0], backgroundColor: '#e74c3c', borderRadius: 4 }] },
            options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });

        const ctxTopDrugs = document.getElementById('chart-top-drugs').getContext('2d');
        this.chartTopDrugsObj = new Chart(ctxTopDrugs, {
            type: 'bar', data: { labels: topDrugLabels, datasets: [{ label: 'จำนวนรวมทั้งหมด (ชิ้น)', data: topDrugData, backgroundColor: '#3498db', borderRadius: 4 }] },
            options: { indexAxis: 'y', maintainAspectRatio: false }
        });
    },

    async doStockTake() {
        const result = await Swal.fire({ title: 'ยืนยันการตรวจสอบ', text: "คุณยืนยันว่าได้ตรวจสอบ รายการยา, จำนวน และวันหมดอายุ ในกล่องว่าถูกต้องตรงกับหน้างานจริงแล้วใช่หรือไม่?", icon: 'question', showCancelButton: true, confirmButtonColor: '#27ae60', confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก' });
        if (!result.isConfirmed) return;

        const res = await this.callAPI({ action: 'stock_take', boxType: this.currentBoxType, boxName: this.currentBoxName, department: this.currentBoxDept, username: this.user.username });
        if (res && res.status === 'success') {
            Swal.fire({ icon: 'success', title: 'เยี่ยมมาก!', text: res.message });
            this.loadDashboardData();
            this.navigateMenu('page-wards');
        } else Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถเชื่อมต่อได้' });
    }
};

window.onload = () => app.init();

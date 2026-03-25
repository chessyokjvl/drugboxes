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
    
    // ตัวแปรสำหรับตาราง (Sort & Export)
    currentGlobalData: [],
    sortConfig: { column: null, asc: true },

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
            Swal.fire({ icon: 'error', title: 'ข้อผิดพลาดเครือข่าย', text: 'การเชื่อมต่อขัดข้อง หรือ URL API ไม่ถูกต้อง' });
        }
    },

    // 📌 ฟังก์ชันดึงสีประจำตึก
    getWardBadgeStyle(deptName) {
        if (deptName.includes('พุทธรักษา')) return 'background-color: #7f8c8d; color: white;'; // เทา
        if (deptName.includes('จำปาทอง')) return 'background-color: #27ae60; color: white;'; // เขียว
        if (deptName.includes('ราชาวดี')) return 'background-color: #2980b9; color: white;'; // น้ำเงิน
        if (deptName.includes('ลีลาวดี')) return 'background-color: #fd79a8; color: white;'; // ชมพู
        if (deptName.includes('ER') || deptName.includes('ฉุกเฉิน')) return 'background-color: #c0392b; color: white;'; // แดง
        if (deptName.includes('ECT')) return 'background-color: #d35400; color: white;'; // ส้ม
        return 'background-color: #34495e; color: white;'; // สีมาตรฐานถ้าไม่ตรงกับด้านบน
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
            document.getElementById('info-drug-prep').innerHTML = '<span style="color:#999;"><i>ไม่มีข้อมูลการเตรียมยา</i></span>';
            document.getElementById('info-drug-admin').innerHTML = '<span style="color:#999;"><i>ไม่มีข้อมูลการบริหารยา</i></span>';
            document.getElementById('info-drug-precautions').innerHTML = '<span style="color:#999;"><i>ไม่มีข้อมูลข้อควรระวัง</i></span>';
        }
        displayDiv.style.display = 'block';
    },

    async login() {
        const u = document.getElementById('login-username').value;
        const p = document.getElementById('login-password').value;
        if (!u || !p) return Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบ', text: "กรุณากรอก Username และ Password" });
        
        const res = await this.callAPI({ action: 'login', username: u, password: p });
        if (res && res.status === 'success') {
            this.user = res.user;
            localStorage.setItem('rxUser', JSON.stringify(res.user));
            Swal.fire({ icon: 'success', title: 'เข้าสู่ระบบสำเร็จ', showConfirmButton: false, timer: 1200 });
            this.showMainApp();
            this.loadDashboardData();
        } else {
            Swal.fire({ icon: 'error', title: 'เข้าสู่ระบบล้มเหลว', text: res ? res.message : 'เกิดข้อผิดพลาด' });
        }
    },

    async register() {
        const u = document.getElementById('reg-username').value;
        const p = document.getElementById('reg-password').value;
        const e = document.getElementById('reg-email').value;
        const d = document.getElementById('reg-dept').value;
        const pdpa = document.getElementById('reg-pdpa').checked;
        if (!u || !p || !e) return Swal.fire({ icon: 'warning', text: "กรุณากรอกข้อมูลให้ครบถ้วน" });
        if (!pdpa) return Swal.fire({ icon: 'warning', title: 'PDPA', text: "กรุณากดยอมรับเงื่อนไข PDPA ก่อนสมัครใช้งาน" }); 

        const res = await this.callAPI({ action: 'register', username: u, password: p, email: e, role: 'User', department: d, pdpaConsent: 'Accepted' });
        if (res && res.status === 'success') {
            Swal.fire({ icon: 'success', title: 'ลงทะเบียนสำเร็จ', text: "กรุณาเข้าสู่ระบบด้วย Username ที่สมัคร" });
            this.navigateAuth('page-login');
            ['reg-username', 'reg-password', 'reg-email'].forEach(id => document.getElementById(id).value = '');
            document.getElementById('reg-pdpa').checked = false;
        } else Swal.fire({ icon: 'error', title: 'ข้อผิดพลาด', text: res ? res.message : '' });
    },

    async forgotPassword() {
        const e = document.getElementById('forgot-email').value;
        if (!e) return Swal.fire({ icon: 'warning', text: "กรุณากรอก E-mail" });
        const res = await this.callAPI({ action: 'reset_password', email: e });
        if (res && res.status === 'success') {
            Swal.fire({ icon: 'success', title: 'ส่งรหัสผ่านแล้ว', text: res.message });
            this.navigateAuth('page-login');
            document.getElementById('forgot-email').value = '';
        } else Swal.fire({ icon: 'error', title: 'ข้อผิดพลาด', text: res ? res.message : 'ไม่พบ E-mail นี้' });
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
            // 📌 ดึงสีประจำตึก
            const badgeStyle = this.getWardBadgeStyle(box.department);

            const card = document.createElement('div');
            card.className = `box-card ${boxColorClass} ${isWarning ? 'warning' : ''}`;
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom: 5px;">
                    <div class="box-title">${box.boxName}</div>
                    ${isSent ? `<span style="background:var(--danger); color:white; padding:2px 6px; border-radius:4px; font-size:0.75rem;">รอเภสัชฯ</span>` : ''}
                </div>
                <div style="margin-bottom: 10px;">
                    <span style="font-size: 0.8rem; padding: 2px 6px; border-radius: 4px; ${badgeStyle}">${box.department}</span>
                </div>
                <div style="font-size: 0.85rem; border-top: 1px solid #eee; padding-top: 10px; display:flex; justify-content:space-between;">
                    <span style="color:#666;">รายการยา: <b>${box.totalDrugs}</b></span>
                    ${isWarning ? `<span style="color:var(--danger); font-weight: 600;">⚠️ ใกล้หมด: ${box.expiringSoon}</span>` : `<span style="color:var(--primary-green);"><i class="fas fa-check-circle"></i> ปกติ</span>`}
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

            const today = new Date();
            const threeMonths = new Date();
            threeMonths.setDate(today.getDate() + 90);

            res.data.forEach(item => {
                const expDate = new Date(item.expireDate);
                const isExpiring = expDate <= threeMonths;
                const isExpired = expDate < today; // 📌 เช็คว่าหมดอายุแล้วหรือยัง
                
                let expLabel = '';
                if (isExpired) expLabel = '<span style="color:red; font-weight:bold;">(หมดอายุแล้ว)</span>';
                else if (isExpiring) expLabel = '<span style="color:#f39c12; font-weight:bold;">⚠️</span>';

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
                        <td class="${isExpiring ? 'exp-warning' : ''}">${item.expireDate} ${expLabel}</td>
                        <td>${item.qty}</td>
                        <td class="no-print" style="white-space: nowrap;">${actionButtons}</td>
                    </tr>
                `;
            });
        }
    },

    // 📌 ฟังก์ชันดึงยาทั้งหมด และรองรับการทำ Sort
    async showFilteredList(filterType) {
        this.currentReturnPage = 'page-filtered-list'; 
        this.currentFilterType = filterType; 
        
        let titleText = 'รายการยาทั้งหมดในระบบ';
        if (filterType === 'expiring') titleText = 'ยาที่หมดอายุแล้ว / หมดอายุภายใน 3 เดือน';
        
        document.getElementById('filtered-list-title').innerText = titleText;
        document.getElementById('print-global-subtitle').innerText = titleText;
        this.navigateMenu('page-filtered-list');

        const res = await this.callAPI({ action: 'get_all_inventory' });
        if (res && res.status === 'success') {
            const today = new Date();
            const threeMonths = new Date();
            threeMonths.setDate(today.getDate() + 90);

            let displayData = res.data;
            if (filterType === 'expiring') {
                displayData = res.data.filter(item => new Date(item.expireDate) <= threeMonths);
            }

            // ตั้งค่าเริ่มต้นการ Sort
            this.currentGlobalData = displayData;
            this.sortConfig = { column: 'drugName', asc: true }; 
            this.renderGlobalTable(); // วาดตาราง
        }
    },

    // 📌 ฟังก์ชันวาดตารางแยกออกมา เพื่อให้เรียกใช้ตอนกด Sort ได้
    renderGlobalTable() {
        const tbody = document.getElementById('filtered-tbody');
        tbody.innerHTML = '';

        if (this.currentGlobalData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">ไม่พบข้อมูล</td></tr>';
            return;
        }

        // เรียงข้อมูลตาม Config ปัจจุบัน
        this.currentGlobalData.sort((a, b) => {
            let valA = a[this.sortConfig.column] || '';
            let valB = b[this.sortConfig.column] || '';
            
            if (valA < valB) return this.sortConfig.asc ? -1 : 1;
            if (valA > valB) return this.sortConfig.asc ? 1 : -1;
            return 0;
        });

        const today = new Date();
        const threeMonths = new Date();
        threeMonths.setDate(today.getDate() + 90);
        const isPharmacy = (this.user.role === 'God Admin' || this.user.role === 'Admin' || this.user.dept === 'กลุ่มงานเภสัชกรรม');

        this.currentGlobalData.forEach(item => {
            const expDate = new Date(item.expireDate);
            const isExpiring = expDate <= threeMonths;
            const isExpired = expDate < today;
            
            let expLabel = '';
            if (isExpired) expLabel = '<span style="color:red; font-weight:bold;">(หมดอายุ)</span>';
            else if (isExpiring) expLabel = '<span style="color:#f39c12; font-weight:bold;">⚠️</span>';

            const itemJson = encodeURIComponent(JSON.stringify(item));
            const isOwner = (this.user.dept === item.department);
            const canEdit = isPharmacy || isOwner;
            const badgeStyle = this.getWardBadgeStyle(item.department);

            let actionBtn = '-';
            if(canEdit) {
                let openPkgBtn = '';
                if (item.drugName.toLowerCase().includes('salbutamol') || item.drugName.toLowerCase().includes('nebule')) {
                    openPkgBtn = `<button class="btn-outline no-print" style="margin-right:5px; border-color:#e67e22; color:#e67e22;" onclick="app.openPackage('${item.itemID}', '${item.drugName}')" title="แกะซอง (อายุ 3 เดือน)"><i class="fas fa-cut"></i></button>`;
                }
                actionBtn = `
                    ${openPkgBtn}
                    <button class="btn-outline no-print" onclick="app.openDrugModalFromGlobal('${itemJson}')" title="แก้ไขรายการ"><i class="fas fa-edit"></i></button>
                `;
            }

            tbody.innerHTML += `
                <tr>
                    <td><span style="font-size:0.8rem; padding:2px 6px; border-radius:4px; ${badgeStyle}">${item.department}</span><br><span style="font-size:0.8rem; color:#666;">${item.boxName}</span></td>
                    <td><b style="font-weight: 500;">${item.drugName}</b></td>
                    <td>${item.lotNumber}</td>
                    <td class="${isExpiring ? 'exp-warning' : ''}">${item.expireDate} ${expLabel}</td>
                    <td>${item.qty}</td>
                    <td><span style="font-size:0.8rem; background:#eee; padding:2px 6px; border-radius:4px;">${item.storageLoc || 'ในกล่อง'}</span></td>
                    <td class="no-print" style="white-space:nowrap;">${actionBtn}</td>
                </tr>
            `;
        });
    },

    // 📌 ฟังก์ชันกด Sort หัวตาราง
    sortTable(columnName) {
        if (this.sortConfig.column === columnName) {
            this.sortConfig.asc = !this.sortConfig.asc; // สลับมาก/น้อย
        } else {
            this.sortConfig.column = columnName;
            this.sortConfig.asc = true;
        }
        this.renderGlobalTable(); // วาดตารางใหม่
    },

    // 📌 ฟังก์ชัน Export เป็นไฟล์ Excel (CSV)
    exportExcel() {
        if (this.currentGlobalData.length === 0) return Swal.fire('ไม่มีข้อมูล', 'ไม่มีข้อมูลสำหรับ Export', 'info');
        
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // ใส่ BOM ป้องกันภาษาไทยเพี้ยน
        csvContent += "หน่วยงาน,ชื่อกล่อง,ชื่อยา,Lot Number,วันหมดอายุ,จำนวน,แหล่งเก็บ\n";
        
        this.currentGlobalData.forEach(item => {
            // ป้องกันเครื่องหมายจุลภาค (,) ในข้อความไปตัดคอลัมน์ Excel
            const dept = `"${item.department}"`;
            const box = `"${item.boxName}"`;
            const dName = `"${item.drugName}"`;
            const lot = `"${item.lotNumber}"`;
            const exp = `"${item.expireDate}"`;
            const qty = `"${item.qty}"`;
            const loc = `"${item.storageLoc}"`;
            
            csvContent += `${dept},${box},${dName},${lot},${exp},${qty},${loc}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `รายงานสต็อกยา_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    openDrugModalFromGlobal(itemJsonEncoded) {
        const item = JSON.parse(decodeURIComponent(itemJsonEncoded));
        this.currentBoxId = item.department + '_' + item.boxName; 
        this.currentBoxDept = item.department;
        this.currentBoxType = item.boxType;
        this.currentBoxName = item.boxName;
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
            if (this.currentReturnPage === 'page-filtered-list') this.showFilteredList(this.currentFilterType);
            else this.openBoxDetail(this.currentBoxId, this.currentBoxDept, this.currentBoxType, this.currentBoxName, this.currentBoxStatus);
        } else Swal.fire({ icon: 'error', title: 'ข้อผิดพลาด', text: 'เกิดข้อผิดพลาดในการบันทึก' });
    },

    async verifyItem(itemId) {
        const res = await this.callAPI({ action: 'verify_item', itemID: itemId, username: this.user.username });
        if (res && res.status === 'success') {
            Swal.fire({ icon: 'success', title: 'เยี่ยมมาก!', text: res.message, timer: 1500, showConfirmButton: false });
            this.openBoxDetail(this.currentBoxId, this.currentBoxDept, this.currentBoxType, this.currentBoxName, this.currentBoxStatus);
        } else Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถบันทึกการตรวจสอบได้' });
    },

    async updateBoxStatus(status) {
        let confirmMsg = status === 'ส่งปรับแก้' ? "ต้องการส่งกล่องนี้ให้ฝ่ายเภสัชกรรมปรับแก้ใช่หรือไม่?" : "ยืนยันการเคลียร์สถานะว่าปรับแก้เรียบร้อยแล้ว?";
        const result = await Swal.fire({
            title: 'ยืนยันการดำเนินการ', text: confirmMsg, icon: 'warning', showCancelButton: true, confirmButtonColor: status === 'ส่งปรับแก้' ? '#e74c3c' : '#27ae60', confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก'
        });
        if (!result.isConfirmed) return;

        const res = await this.callAPI({ action: 'update_box_status', boxName: this.currentBoxName, department: this.currentBoxDept, status: status, username: this.user.username });
        if (res && res.status === 'success') {
            Swal.fire({ icon: 'success', title: 'สำเร็จ', text: res.message });
            this.loadDashboardData();
            this.navigateMenu('page-wards'); 
        } else Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถอัปเดตสถานะได้' });
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

        if (!payload.drugName || !payload.expireDate || !payload.verifiedBy) return Swal.fire({ icon: 'warning', text: "กรุณากรอก ชื่อยา, วันหมดอายุ และ ชื่อผู้ตรวจสอบให้ครบถ้วน" });

        const res = await this.callAPI(payload);
        if (res && res.status === 'success') {
            Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', text: res.message, timer: 1500, showConfirmButton: false });
            this.closeModal();
            if (this.currentReturnPage === 'page-filtered-list') this.showFilteredList(this.currentFilterType);
            else this.openBoxDetail(this.currentBoxId, this.currentBoxDept, this.currentBoxType, this.currentBoxName, this.currentBoxStatus);
        } else Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: res ? res.message : 'ไม่ทราบสาเหตุ' });
    },

    async openAnalytics(menuItem) {
        this.navigateMenu('page-analytics', menuItem);
        const res = await this.callAPI({ action: 'get_all_inventory' });
        if (res && res.status === 'success') {
            const data = res.data;
            const today = new Date();
            const threeMonths = new Date();
            threeMonths.setDate(today.getDate() + 90);

            let safeCount = 0, exp3mCount = 0, expiredCount = 0;
            data.forEach(item => {
                const expDate = new Date(item.expireDate);
                if (expDate < today) expiredCount++;
                else if (expDate <= threeMonths) exp3mCount++;
                else safeCount++;
            });

            const wardExpMap = {};
            data.forEach(item => {
                const expDate = new Date(item.expireDate);
                if (expDate <= threeMonths) wardExpMap[item.department] = (wardExpMap[item.department] || 0) + 1;
            });
            const wardLabels = Object.keys(wardExpMap);
            const wardData = Object.values(wardExpMap);

            const drugCountMap = {};
            data.forEach(item => { drugCountMap[item.drugName] = (drugCountMap[item.drugName] || 0) + Number(item.qty); });
            const sortedDrugs = Object.entries(drugCountMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const topDrugLabels = sortedDrugs.map(d => d[0]);
            const topDrugData = sortedDrugs.map(d => d[1]);

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
        }
    },

    async doStockTake() {
        const result = await Swal.fire({ title: 'ยืนยันการตรวจสอบ', text: "คุณยืนยันว่าได้ตรวจสอบ รายการยา, จำนวน และวันหมดอายุ ในกล่องว่าถูกต้องตรงกับหน้างานจริงแล้วใช่หรือไม่?", icon: 'question', showCancelButton: true, confirmButtonColor: '#27ae60', confirmButtonText: 'ยืนยันการตรวจสอบ', cancelButtonText: 'ยกเลิก' });
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

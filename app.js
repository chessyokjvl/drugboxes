const API_URL = 'https://script.google.com/macros/s/AKfycbwIbf8w_VSw5pCJXnUGtRgut8beeqG3wx2qkGbrU9fOHiaxbM5WA07FFBrZsbzxc3E3/exec';
const app = {
    // State ตัวแปรสำหรับเก็บข้อมูลสถานะปัจจุบันของระบบ
    user: null,
    currentBoxId: null, 
    currentBoxDept: null,
    currentBoxType: null,

    // ==========================================
    // 🚀 ระบบเริ่มต้นและการนำทาง
    // ==========================================
    init() {
        // เช็คว่าเคย Login ไว้แล้วหรือไม่
        const userStr = localStorage.getItem('rxUser');
        if (userStr) {
            this.user = JSON.parse(userStr);
            this.loadDashboard();
        } else {
            this.navigate('page-login');
        }
    },

    navigate(pageId) {
        // ซ่อนทุกหน้า และแสดงเฉพาะหน้าที่ถูกเรียก
        document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        
        // จัดการหน้า Login ให้แสดงผลตรงกลาง
        document.getElementById('page-login').style.display = pageId === 'page-login' ? 'flex' : '';
    },

    showLoader(show) { 
        document.getElementById('loader').style.display = show ? 'flex' : 'none'; 
    },

    // ==========================================
    // 🌐 ระบบเชื่อมต่อ API (Backend)
    // ==========================================
    async callAPI(payload) {
        this.showLoader(true);
        try {
            const res = await fetch(API_URL, { 
                method: 'POST', 
                body: JSON.stringify(payload) 
            });
            const data = await res.json();
            this.showLoader(false);
            return data;
        } catch (err) {
            this.showLoader(false);
            console.error("API Error: ", err);
            alert('การเชื่อมต่อขัดข้อง กรุณาตรวจสอบอินเทอร์เน็ตหรือ URL ของ API');
        }
    },

    // ==========================================
    // 🔐 ระบบ Authentication
    // ==========================================
    async login() {
        const u = document.getElementById('login-username').value;
        const p = document.getElementById('login-password').value;
        if (!u || !p) return alert("กรุณากรอก Username และ Password ให้ครบถ้วน");

        const res = await this.callAPI({ action: 'login', username: u, password: p });
        
        if (res && res.status === 'success') {
            this.user = res.user;
            localStorage.setItem('rxUser', JSON.stringify(res.user));
            this.loadDashboard();
        } else {
            alert(res ? res.message : 'ไม่สามารถเข้าสู่ระบบได้');
        }
    },

    logout() {
        localStorage.removeItem('rxUser');
        this.user = null;
        
        // ล้างค่าฟอร์ม Login
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        
        this.navigate('page-login');
    },

    // ==========================================
    // 📊 ระบบ Dashboard ภาพรวม
    // ==========================================
    async loadDashboard() {
        document.getElementById('user-display').innerText = `👨‍⚕️ ผู้ใช้: ${this.user.username} (${this.user.role})`;
        this.navigate('page-dashboard');
        
        const res = await this.callAPI({ action: 'get_dashboard' });
        
        if (res && res.status === 'success') {
            const container = document.getElementById('dashboard-container');
            container.innerHTML = ''; // ล้างข้อมูลเก่า
            
            if(res.data.length === 0) {
                container.innerHTML = '<p style="color:#666; width: 100%; text-align: center;">ยังไม่มีข้อมูลกล่องยาในระบบ</p>';
                return;
            }

            res.data.forEach(box => {
                const isWarning = box.status === 'warning';
                const card = document.createElement('div');
                card.className = `box-card ${isWarning ? 'warning' : ''}`;
                card.innerHTML = `
                    <div class="box-title">${box.boxType}</div>
                    <div style="color: #666; margin: 10px 0;"><i class="fas fa-hospital"></i> ${box.department}</div>
                    <div style="font-size: 0.9rem; padding-top: 10px; border-top: 1px solid #eee;">
                        <span>รายการทั้งหมด: <b>${box.totalDrugs}</b></span><br>
                        ${isWarning 
                            ? `<span style="color:#e74c3c; font-weight: 600;">⚠️ ใกล้หมดอายุ: ${box.expiringSoon} รายการ</span>` 
                            : `<span style="color:var(--primary-green); font-weight: 500;">✅ สถานะปกติ</span>`}
                    </div>
                `;
                
                // เมื่อคลิกที่กล่อง ให้เปิดหน้ารายละเอียด
                card.onclick = () => this.openBoxDetail(box.id, box.department, box.boxType);
                container.appendChild(card);
            });
        }
    },

    // ==========================================
    // 💊 ระบบจัดการรายการยาในกล่อง (Box Detail)
    // ==========================================
    async openBoxDetail(boxId, dept, type) {
        // บันทึกสถานะกล่องปัจจุบันไว้ใช้ตอนเพิ่ม/แก้ไขยา
        this.currentBoxId = boxId;
        this.currentBoxDept = dept;
        this.currentBoxType = type;
        
        document.getElementById('detail-title').innerText = `${type} - ${dept}`;
        this.navigate('page-box-detail');
        
        // เช็ค Role ผู้ใช้งาน เพื่อซ่อน/แสดงปุ่ม "เพิ่มรายการ"
        const btnAdd = document.getElementById('btn-add-drug');
        btnAdd.style.display = (this.user.role === 'God Admin' || this.user.role === 'Admin') ? 'block' : 'none';
        btnAdd.onclick = () => this.openDrugModal();

        const res = await this.callAPI({ action: 'get_box_detail', boxId: boxId });
        
        if (res && res.status === 'success') {
            const tbody = document.getElementById('detail-tbody');
            tbody.innerHTML = '';
            
            if(res.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">ไม่พบรายการยาในกล่องนี้</td></tr>';
                return;
            }

            // คำนวณวันที่ล่วงหน้า 3 เดือนสำหรับแจ้งเตือนในตาราง
            const threeMonths = new Date();
            threeMonths.setDate(new Date().getDate() + 90);

            res.data.forEach(item => {
                const expDate = new Date(item.expireDate);
                const isExpiring = expDate <= threeMonths;
                
                // แปลงข้อมูลยาเป็น String แบบปลอดภัยเพื่อส่งเข้าฟังก์ชันแก้ไข
                const itemJson = encodeURIComponent(JSON.stringify(item));
                
                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight: 500;">${item.drugName}</td>
                        <td>${item.lotNumber}</td>
                        <td class="${isExpiring ? 'exp-warning' : ''}">
                            ${item.expireDate} ${isExpiring ? '⚠️' : ''}
                        </td>
                        <td>${item.qty}</td>
                        <td style="font-size: 0.85rem; color: #666;">${new Date(item.lastUpdate).toLocaleDateString('th-TH')}</td>
                        <td>
                            ${(this.user.role === 'God Admin' || this.user.role === 'Admin') 
                                ? `<button class="btn-outline" style="color:var(--text-dark); border-color:#ccc; padding: 5px 10px;" onclick="app.openDrugModal('${itemJson}')"><i class="fas fa-edit"></i> แก้ไข</button>` 
                                : '-'}
                        </td>
                    </tr>
                `;
            });
        }
    },

    // ==========================================
    // 📝 ระบบฟอร์ม (Modal) เพิ่ม/แก้ไขยา
    // ==========================================
    openDrugModal(itemJsonEncoded = null) {
        const modal = document.getElementById('modal-drug');
        if (!modal) return alert("ไม่พบหน้าต่าง Modal กรุณาตรวจสอบโค้ด HTML");
        
        modal.style.display = 'flex';
        
        if (itemJsonEncoded) {
            // ---- โหมดแก้ไข (Edit) ----
            document.getElementById('modal-title').innerText = "แก้ไขรายการยา";
            const item = JSON.parse(decodeURIComponent(itemJsonEncoded));
            
            document.getElementById('form-item-id').value = item.itemID;
            document.getElementById('form-drug-name').value = item.drugName;
            document.getElementById('form-lot').value = item.lotNumber;
            document.getElementById('form-qty').value = item.qty;
            document.getElementById('form-exp').value = item.expireDate; // ต้องเป็น Format YYYY-MM-DD
            document.getElementById('form-is-opened').checked = false; 
            document.getElementById('form-verifier').value = ''; // เคลียร์ชื่อผู้ตรวจสอบให้กรอกใหม่เสมอเพื่อความปลอดภัย
        } else {
            // ---- โหมดเพิ่มใหม่ (Add New) ----
            document.getElementById('modal-title').innerText = "เพิ่มรายการยาใหม่";
            
            document.getElementById('form-item-id').value = '';
            document.getElementById('form-drug-name').value = '';
            document.getElementById('form-lot').value = '';
            document.getElementById('form-qty').value = '';
            document.getElementById('form-exp').value = '';
            document.getElementById('form-is-opened').checked = false;
            document.getElementById('form-verifier').value = '';
        }
    },

    closeModal() {
        const modal = document.getElementById('modal-drug');
        if(modal) modal.style.display = 'none';
    },

    async saveDrug() {
        // เตรียมข้อมูลส่งไปที่ API
        const payload = {
            action: 'save_drug',
            itemID: document.getElementById('form-item-id').value,
            boxId: this.currentBoxId,
            boxType: this.currentBoxType,
            department: this.currentBoxDept,
            drugName: document.getElementById('form-drug-name').value,
            lotNumber: document.getElementById('form-lot').value,
            qty: document.getElementById('form-qty').value,
            expireDate: document.getElementById('form-exp').value,
            isOpened: document.getElementById('form-is-opened').checked, // ตรวจสอบเงื่อนไขแกะซอง
            status: 'Active',
            username: this.user.username, // ชื่อคนล็อกอินที่ทำรายการ
            verifiedBy: document.getElementById('form-verifier').value // ชื่อเภสัชกรผู้ตรวจสอบ
        };

        // ตรวจสอบความครบถ้วนของข้อมูลเบื้องต้น
        if (!payload.drugName) return alert("กรุณาระบุชื่อยา");
        if (!payload.expireDate && !payload.isOpened) return alert("กรุณาระบุวันหมดอายุ หรือ ติ๊กเลือกกรณีแกะซองแล้ว");
        if (!payload.verifiedBy) return alert("กรุณาระบุชื่อเภสัชกรผู้ตรวจสอบ");

        const res = await this.callAPI(payload);
        
        if (res && res.status === 'success') {
            alert(res.message);
            this.closeModal();
            // โหลดรายการยาในกล่องนั้นขึ้นมาแสดงใหม่ เพื่อให้เห็นข้อมูลล่าสุดทันที
            this.openBoxDetail(this.currentBoxId, this.currentBoxDept, this.currentBoxType);
        } else {
            alert('เกิดข้อผิดพลาด: ' + (res ? res.message : 'ไม่ทราบสาเหตุ'));
        }
    }
};

// ==========================================
// 🚀 เริ่มต้นการทำงานเมื่อโหลดหน้าเว็บเสร็จ
// ==========================================
window.onload = () => {
    app.init();
};

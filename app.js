const API_URL = 'https://script.google.com/macros/s/AKfycbwIbf8w_VSw5pCJXnUGtRgut8beeqG3wx2qkGbrU9fOHiaxbM5WA07FFBrZsbzxc3E3/exec';

const app = {
    user: null,

    init() {
        const userStr = localStorage.getItem('rxUser');
        if (userStr) {
            this.user = JSON.parse(userStr);
            this.loadDashboard();
        }
    },

    navigate(pageId) {
        document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        document.getElementById('page-login').style.display = pageId === 'page-login' ? 'flex' : '';
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

    async login() {
        const u = document.getElementById('login-username').value;
        const p = document.getElementById('login-password').value;
        if (!u || !p) return alert("กรุณากรอกข้อมูลให้ครบ");

        const res = await this.callAPI({ action: 'login', username: u, password: p });
        if (res.status === 'success') {
            this.user = res.user;
            localStorage.setItem('rxUser', JSON.stringify(res.user));
            this.loadDashboard();
        } else alert(res.message);
    },

    logout() {
        localStorage.removeItem('rxUser');
        this.user = null;
        this.navigate('page-login');
    },

    async loadDashboard() {
        document.getElementById('user-display').innerText = `👨‍⚕️ ${this.user.username} (${this.user.role})`;
        this.navigate('page-dashboard');
        
        const res = await this.callAPI({ action: 'get_dashboard' });
        if (res.status === 'success') {
            const container = document.getElementById('dashboard-container');
            container.innerHTML = '';
            res.data.forEach(box => {
                const isWarning = box.status === 'warning';
                const card = document.createElement('div');
                card.className = `box-card ${isWarning ? 'warning' : ''}`;
                card.innerHTML = `
                    <div class="box-title">${box.boxType}</div>
                    <div style="color: #666; margin: 10px 0;"><i class="fas fa-hospital"></i> ${box.department}</div>
                    <div style="font-size: 0.9rem;">
                        รายการ: ${box.totalDrugs} | ${isWarning ? `<span style="color:red;">ใกล้หมดอายุ: ${box.expiringSoon}</span>` : '✅ ปกติ'}
                    </div>
                `;
                card.onclick = () => this.openBoxDetail(box.id, box.department, box.boxType);
                container.appendChild(card);
            });
        }
    },

    async openBoxDetail(boxId, dept, type) {
        document.getElementById('detail-title').innerText = `${type} - ${dept}`;
        this.navigate('page-box-detail');
        
        // เช็ค Role เพื่อซ่อน/แสดง ปุ่มเพิ่มรายการยา
        document.getElementById('btn-add-drug').style.display = (this.user.role === 'God Admin' || this.user.role === 'Admin') ? 'block' : 'none';

        const res = await this.callAPI({ action: 'get_box_detail', boxId: boxId });
        if (res.status === 'success') {
            const tbody = document.getElementById('detail-tbody');
            tbody.innerHTML = '';
            
            const threeMonths = new Date();
            threeMonths.setDate(new Date().getDate() + 90);

            res.data.forEach(item => {
                const expDate = new Date(item.expireDate);
                const isExpiring = expDate <= threeMonths;
                
                tbody.innerHTML += `
                    <tr>
                        <td>${item.drugName}</td>
                        <td>${item.lotNumber}</td>
                        <td class="${isExpiring ? 'exp-warning' : ''}">${item.expireDate} ${isExpiring ? '⚠️' : ''}</td>
                        <td>${item.qty}</td>
                        <td>${new Date(item.lastUpdate).toLocaleDateString('th-TH')}</td>
                        <td>
                            ${(this.user.role === 'God Admin' || this.user.role === 'Admin') ? `<button class="btn-outline" style="color:var(--text-dark); border-color:#ccc;"><i class="fas fa-edit"></i></button>` : '-'}
                        </td>
                    </tr>
                `;
            });
        }
    }
};

window.onload = () => app.init();

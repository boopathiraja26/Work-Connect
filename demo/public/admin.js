document.addEventListener('DOMContentLoaded', function () {
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const loginError = document.getElementById('loginError');
    const workersGrid = document.getElementById('workersGrid');

    let revenueChart = null;
    let categoryChart = null;

    // Check auth
    const checkAuth = () => {
        try {
            const adminData = localStorage.getItem('admin');
            return adminData ? JSON.parse(adminData) : null;
        } catch (e) { return null; }
    };

    if (checkAuth()) showDashboard();

    adminLoginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const username = document.getElementById('adminUsername').value;
        const password = document.getElementById('adminPassword').value;

        try {
            const res = await fetch(getApiUrl('/api/admin/login'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('admin', JSON.stringify(data.admin));
                showDashboard();
            } else showError(data.message || 'Login failed');
        } catch (err) { showError('Server connection error'); }
    });

    function showDashboard() {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        document.body.classList.remove('not-logged-in');
        loadStats();
        loadWorkers();
        loadOrders();
    }

    window.switchTab = function (tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        event.currentTarget.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
        document.getElementById(tab + 'Tab').style.display = 'block';
        if (tab === 'overview') loadStats();
        if (tab === 'workers') loadWorkers();
        if (tab === 'orders') loadOrders();
    };

    async function loadStats() {
        try {
            const res = await fetch(getApiUrl('/api/admin/stats'));
            const stats = await res.json();
            document.getElementById('totalRevenue').textContent = '₹' + (stats.totalRevenue || 0).toLocaleString('en-IN');
            document.getElementById('totalOrdersCount').textContent = stats.totalOrders || 0;
            document.getElementById('activeUsersCount').textContent = stats.totalUsers || 0;
            document.getElementById('avgSystemRating').textContent = (stats.avgRating || 4.8).toFixed(1);

            // Navbar stats
            if (document.getElementById('totalWorkers')) {
                document.getElementById('totalWorkers').textContent = stats.totalWorkers || 0;
            }
            if (document.getElementById('pendingApprovals')) {
                document.getElementById('pendingApprovals').textContent = stats.pendingApprovals || 0;
            }

            renderCharts(stats);
        } catch (e) { console.error('Stats error', e); }
    }

    function renderCharts(stats) {
        const catCtx = document.getElementById('categoryChart').getContext('2d');
        if (categoryChart) categoryChart.destroy();
        categoryChart = new Chart(catCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(stats.serviceSplit || {}),
                datasets: [{
                    data: Object.values(stats.serviceSplit || {}),
                    backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#a855f7'],
                    hoverOffset: 15,
                    borderWidth: 0
                }]
            },
            options: { plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } } }, cutout: '70%' }
        });

        const revCtx = document.getElementById('revenueChart').getContext('2d');
        if (revenueChart) revenueChart.destroy();
        const labels = ['6d ago', '5d ago', '4d ago', '3d ago', '2d ago', 'Yesterday', 'Today'];

        revenueChart = new Chart(revCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue (₹)',
                    data: stats.revenueTrend || [0, 0, 0, 0, 0, 0, 0],
                    borderColor: '#38bdf8',
                    borderWidth: 4,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#38bdf8',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    fill: 'start',
                    backgroundColor: (context) => {
                        const gradient = context.chart.ctx.createLinearGradient(0, 0, 0, 400);
                        gradient.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
                        gradient.addColorStop(1, 'rgba(56, 189, 248, 0)');
                        return gradient;
                    },
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } },
                plugins: { legend: { display: false } }
            }
        });
    }

    async function loadWorkers() {
        const grid = document.getElementById('workersGrid');
        grid.innerHTML = '<div class="loading">Loading workers...</div>';
        try {
            const res = await fetch(getApiUrl('/api/admin/workers'));
            const workers = await res.json();
            grid.innerHTML = '';

            document.getElementById('totalWorkers').textContent = workers.length;
            const pending = workers.filter(w => w.approved === 'pending' || w.approved === false || !w.approved).length;
            document.getElementById('pendingApprovals').textContent = pending;

            workers.forEach(worker => {
                let status = 'pending';
                if (worker.approved === true || worker.approved === 'true' || worker.approved === 'approved') status = 'approved';
                else if (worker.approved === 'rejected') status = 'rejected';

                const card = document.createElement('div');
                card.className = 'worker-card';
                card.innerHTML = `
                    <div class="worker-header">
                        <div class="worker-profile">
                            <div class="worker-avatar">${(worker.name || 'W')[0].toUpperCase()}</div>
                            <div class="worker-identity">
                                <h3>${worker.name || 'Unnamed Worker'}</h3>
                                <p>@${worker.username}</p>
                            </div>
                        </div>
                        <span class="status-badge-card status-${status}">${status}</span>
                    </div>
                    <div class="worker-body">
                        <div class="info-item"><i class="fas fa-envelope info-icon"></i> ${worker.email}</div>
                        <div class="info-item"><i class="fas fa-phone info-icon"></i> ${worker.phone}</div>
                        <div class="info-item"><i class="fas fa-id-card info-icon"></i> AADHAAR: <strong>${worker.aadhaarNumber || 'N/A'}</strong></div>
                    </div>
                    <div class="worker-actions">
                        <button class="action-btn approve-btn" onclick="approveWorker('${worker.id}', 'approved')" ${status === 'approved' ? 'disabled' : ''}>
                            <i class="fas fa-check"></i> ${status === 'approved' ? 'Approved' : 'Approve'}
                        </button>
                        <button class="action-btn reject-btn" onclick="approveWorker('${worker.id}', 'rejected')" ${status === 'rejected' ? 'disabled' : ''}>
                            <i class="fas fa-times"></i> ${status === 'rejected' ? 'Rejected' : 'Reject'}
                        </button>
                    </div>
                `;
                grid.appendChild(card);
            });
        } catch (e) { grid.innerHTML = '<div class="error">Failed to load workforce data</div>'; }
    }

    async function loadOrders() {
        const list = document.getElementById('allOrdersList');
        list.innerHTML = '<tr><td colspan="7" style="text-align:center;">Syncing global order history...</td></tr>';
        try {
            const res = await fetch(getApiUrl('/api/admin/orders'));
            const orders = await res.json();
            list.innerHTML = '';
            if (!orders.length) {
                list.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem;">No orders found in the system</td></tr>';
                return;
            }
            orders.forEach(order => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-family: monospace; font-weight: bold;">#${order.id.slice(-6).toUpperCase()}</td>
                    <td><div style="display:flex; align-items:center; gap:0.5rem;"><i class="fas fa-tools" style="color:#6366f1"></i> ${order.serviceType}</div></td>
                    <td>${order.customerName}</td>
                    <td>${order.workerName}</td>
                    <td style="font-weight:700; color:#10b981;">₹${order.totalAmount}</td>
                    <td><span class="order-badge badge-${order.status}">${order.status}</span></td>
                    <td>${new Date(order.createdAt).toLocaleDateString('en-GB')}</td>
                `;
                list.appendChild(tr);
            });
        } catch (e) { list.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#f43f5e;">Failed to load order records</td></tr>'; }
    }

    window.approveWorker = async function (id, status) {
        try {
            const res = await fetch(getApiUrl(`/api/admin/worker/${id}/approve`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ approved: status })
            });
            if (res.ok) loadWorkers();
            else alert('Approval failed');
        } catch (e) { alert('Network error'); }
    };

    window.logout = function () {
        localStorage.removeItem('admin');
        window.location.href = 'login.html';
    };

    function showError(msg) {
        loginError.textContent = msg;
        loginError.classList.add('show');
        setTimeout(() => loginError.classList.remove('show'), 3000);
    }
});
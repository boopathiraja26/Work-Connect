document.addEventListener('DOMContentLoaded', function() {
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const loginError = document.getElementById('loginError');
    const workersTableBody = document.getElementById('workersTableBody');

    // Check if already logged in
    if (localStorage.getItem('admin')) {
        loginSection.style.display = 'none';
        dashboardSection.style.display = '';
        loadWorkers();
    }

    adminLoginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        loginError.textContent = '';
        const username = document.getElementById('adminUsername').value;
        const password = document.getElementById('adminPassword').value;
        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('admin', JSON.stringify(data.admin));
                loginSection.style.display = 'none';
                dashboardSection.style.display = '';
                loadWorkers();
            } else {
                loginError.textContent = data.message || 'Login failed';
            }
        } catch (err) {
            loginError.textContent = 'Error logging in';
        }
    });

    async function loadWorkers() {
        workersTableBody.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';
        try {
            const res = await fetch('/api/admin/workers');
            const workers = await res.json();
            workersTableBody.innerHTML = '';
            workers.forEach(worker => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${worker.name || ''}</td>
                    <td>${worker.username}</td>
                    <td>${worker.email}</td>
                    <td>${worker.phone}</td>
                    <td>${worker.aadhaarNumber || ''}</td>
                    <td>${worker.approved ? '<span class="status-approved">Approved</span>' : '<span class="status-pending">Pending</span>'}</td>
                    <td>
                        <button class="approve-btn" ${worker.approved ? 'disabled' : ''} onclick="approveWorker('${worker.id}', true)">Approve</button>
                        <button class="reject-btn" ${!worker.approved ? 'disabled' : ''} onclick="approveWorker('${worker.id}', false)">Reject</button>
                    </td>
                `;
                workersTableBody.appendChild(tr);
            });
        } catch (err) {
            workersTableBody.innerHTML = '<tr><td colspan="7">Error loading workers</td></tr>';
        }
    }

    window.approveWorker = async function(id, approved) {
        try {
            await fetch(`/api/admin/worker/${id}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ approved })
            });
            loadWorkers();
        } catch (err) {
            alert('Error updating approval');
        }
    };
});
const Toast = {
    container: null,

    init() {
        if (!document.getElementById('toast-container')) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('toast-container');
        }
    },

    show(message, type = 'info', title = null) {
        if (!this.container) this.init();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        // Define Icon
        let iconClass = 'fa-info-circle';
        if (type === 'success') iconClass = 'fa-check-circle';
        if (type === 'error') iconClass = 'fa-exclamation-circle';
        if (type === 'warning') iconClass = 'fa-exclamation-triangle';

        // Auto-title if null
        if (!title) {
            title = type.charAt(0).toUpperCase() + type.slice(1);
        }

        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;

        // Click to dismiss
        toast.addEventListener('click', () => {
            toast.classList.add('hiding');
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 300);
        });

        // Auto dismiss
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('hiding');
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000); // 5 seconds

        this.container.appendChild(toast);
    },

    success(msg, title) { this.show(msg, 'success', title); },
    error(msg, title) { this.show(msg, 'error', title); },
    warning(msg, title) { this.show(msg, 'warning', title); },
    info(msg, title) { this.show(msg, 'info', title); }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => Toast.init());

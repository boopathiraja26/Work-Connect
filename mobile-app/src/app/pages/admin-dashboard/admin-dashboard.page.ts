import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ToastController, AlertController } from '@ionic/angular';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.page.html',
  styleUrls: ['./admin-dashboard.page.scss'],
  standalone: false,
})
export class AdminDashboardPage implements OnInit {
  activeTab = 'approvals';
  stats: any = {
    totalRevenue: 0,
    totalOrders: 0,
    activeUsers: 0
  };
  pendingWorkers: any[] = [];
  allWorkers: any[] = [];
  allOrders: any[] = [];
  allTickets: any[] = [];
  loading = false;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) { }

  ngOnInit() {
    this.loadAllData();
  }

  async loadAllData() {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      this.router.navigate(['/login']);
      return;
    }
    const user = JSON.parse(userStr);
    if (user.role !== 'admin') {
      // If we don't have a specific admin role check, we might need a separate login for admin
      // for now assume if they got here they might be authorized or check role
    }

    this.loadStats();
    this.loadWorkers();
    this.loadOrders();
    this.loadTickets();
  }

  loadStats() {
    this.apiService.getAdminStats().subscribe({
      next: (data) => this.stats = data,
      error: () => console.error('Failed to load stats')
    });
  }

  loadWorkers() {
    this.apiService.getAdminWorkers().subscribe({
      next: (data) => {
        this.allWorkers = data;
        this.pendingWorkers = data.filter((w: any) => w.approved === 'pending');
      },
      error: () => this.showToast('Failed to load workers', 'danger')
    });
  }

  loadOrders() {
    this.apiService.getAdminOrders().subscribe({
      next: (data) => this.allOrders = data,
      error: () => console.error('Failed to load orders')
    });
  }

  loadTickets() {
    this.apiService.getAdminTickets().subscribe({
      next: (data) => {
        // Initialize reply property for each pending ticket
        this.allTickets = data.map((t: any) => ({ ...t, reply: '' }));
      },
      error: () => console.error('Failed to load tickets')
    });
  }

  resolveTicket(ticket: any) {
    this.apiService.resolveTicket(ticket.id || ticket._id, ticket.reply).subscribe({
      next: () => {
        this.showToast('Ticket resolved and notification sent!', 'success');
        this.loadTickets();
      },
      error: () => this.showToast('Failed to resolve ticket', 'danger')
    });
  }

  async approve(worker: any, status: string) {
    const alert = await this.alertCtrl.create({
      header: 'Confirm Action',
      message: `Are you sure you want to set status to ${status} for ${worker.name || worker.username}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm',
          handler: () => {
            this.apiService.approveWorker(worker.id || worker._id, status).subscribe({
              next: () => {
                this.showToast(`Worker ${status} successfully`, 'success');
                this.loadWorkers();
                this.loadStats();
              },
              error: () => this.showToast('Failed to update status', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  getStatusColor(status: string) {
    switch (status) {
      case 'Pending': return 'warning';
      case 'Accepted': return 'primary';
      case 'Completed': return 'success';
      case 'Cancelled': return 'danger';
      default: return 'medium';
    }
  }

  logout() {
    localStorage.removeItem('user');
    this.router.navigate(['/login']);
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}

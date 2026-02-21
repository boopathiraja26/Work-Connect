import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ToastController, LoadingController } from '@ionic/angular';

@Component({
  selector: 'app-worker-dashboard',
  templateUrl: './worker-dashboard.page.html',
  styleUrls: ['./worker-dashboard.page.scss'],
  standalone: false,
})
export class WorkerDashboardPage implements OnInit {
  activeTab = 'orders';
  userData: any;
  worker: any;
  orders: any[] = [];
  saving = false;

  editData = {
    name: '',
    availability: '',
    hourlyRate: 0,
    description: ''
  };

  constructor(
    private apiService: ApiService,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) { }

  ngOnInit() {
    this.loadInitialData();
  }

  async loadInitialData() {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      this.router.navigate(['/login']);
      return;
    }
    this.userData = JSON.parse(userStr);

    await this.loadWorkerProfile();
    await this.loadOrders();
  }

  async loadWorkerProfile() {
    this.apiService.getWorkerProfile(this.userData.id || this.userData._id).subscribe({
      next: (data) => {
        this.worker = data;
        this.editData = {
          name: data.name || '',
          availability: data.availability || 'Available',
          hourlyRate: data.hourlyRate || 0,
          description: data.description || ''
        };
      },
      error: () => this.showToast('Failed to load profile', 'danger')
    });
  }

  async loadOrders() {
    this.apiService.getOrders(this.userData.id || this.userData._id).subscribe({
      next: (data) => {
        this.orders = Array.isArray(data) ? data : [];
      },
      error: () => this.showToast('Failed to load orders', 'danger')
    });
  }

  async doRefresh(event: any) {
    await Promise.all([this.loadWorkerProfile(), this.loadOrders()]);
    event.target.complete();
  }

  async saveProfile() {
    this.saving = true;
    const formData = new FormData();
    formData.append('name', this.editData.name);
    formData.append('availability', this.editData.availability);
    formData.append('hourlyRate', this.editData.hourlyRate.toString());
    formData.append('description', this.editData.description);

    this.apiService.updateWorkerProfile(this.userData.id || this.userData._id, formData).subscribe({
      next: () => {
        this.saving = false;
        this.showToast('Profile updated!', 'success');
        this.loadWorkerProfile();
      },
      error: () => {
        this.saving = false;
        this.showToast('Update failed', 'danger');
      }
    });
  }

  updateStatus(order: any, newStatus: string) {
    this.apiService.updateOrderStatus(order._id, { status: newStatus }).subscribe({
      next: () => {
        this.showToast(`Order marked as ${newStatus}`, 'success');
        this.loadOrders();
      },
      error: () => this.showToast('Status update failed', 'danger')
    });
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

  selectImage() {
    this.showToast('Capacitor Camera integration required for uploads', 'primary');
  }

  addPortfolio() {
    this.showToast('Portfolio upload coming soon', 'primary');
  }

  deletePortfolio(img: string) {
    this.showToast('Delete functionality coming soon', 'primary');
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

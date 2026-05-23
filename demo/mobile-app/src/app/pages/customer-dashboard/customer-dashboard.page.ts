import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ToastController, LoadingController, AlertController, ModalController } from '@ionic/angular';

@Component({
  selector: 'app-customer-dashboard',
  templateUrl: './customer-dashboard.page.html',
  styleUrls: ['./customer-dashboard.page.scss'],
  standalone: false,
})
export class CustomerDashboardPage implements OnInit {
  activeTab = 'find';
  userData: any;
  workers: any[] = [];
  filteredWorkers: any[] = [];
  orders: any[] = [];
  searchQuery = '';
  loading = false;
  unreadCount = 0;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController
  ) { }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
      }
    });
    this.loadInitialData();
  }

  async loadInitialData() {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      this.router.navigate(['/login']);
      return;
    }
    this.userData = JSON.parse(userStr);

    await this.loadWorkers();
    await this.loadOrders();
    this.loadUnreadCount();
  }

  loadUnreadCount() {
    const userId = this.userData.id || this.userData._id;
    this.apiService.getNotifications(userId).subscribe({
      next: (data) => {
        this.unreadCount = data.filter((n: any) => !n.read).length;
      }
    });
  }

  async loadWorkers() {
    this.loading = true;
    this.apiService.getWorkers().subscribe({
      next: (data) => {
        this.workers = data;
        this.filteredWorkers = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.showToast('Failed to load workers', 'danger');
      }
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

  onSearch(event: any) {
    const query = event.target.value.toLowerCase();
    this.filteredWorkers = this.workers.filter(w =>
      (w.name?.toLowerCase().includes(query)) ||
      (w.skills?.some((s: string) => s.toLowerCase().includes(query))) ||
      (w.username?.toLowerCase().includes(query))
    );
  }

  viewWorker(worker: any) {
    this.router.navigate(['/worker-details', worker.id || worker._id]);
  }

  async leaveReview(order: any) {
    let selectedRating = 5;
    const alert = await this.alertCtrl.create({
      header: 'Leave a Review',
      subHeader: `For: ${order.worker?.username || order.workerName || 'Worker'}`,
      inputs: [
        {
          name: 'rating',
          type: 'number',
          placeholder: 'Rating (1-5)',
          min: 1,
          max: 5,
          value: 5,
          label: 'Rating (1-5)'
        },
        {
          name: 'comment',
          type: 'textarea',
          placeholder: 'Write your review here...',
          label: 'Your Review'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Submit',
          handler: (data) => {
            if (!data.comment || !data.rating) {
              this.showToast('Please fill in all fields', 'warning');
              return false;
            }
            const workerId = order.workerId || order.worker?.id;
            this.apiService.addReview(workerId, {
              customerId: this.userData.id || this.userData._id,
              customerName: this.userData.username || this.userData.name,
              rating: Number(data.rating),
              comment: data.comment
            }).subscribe({
              next: () => this.showToast('Review submitted! Thank you.', 'success'),
              error: () => this.showToast('Failed to submit review', 'danger')
            });
            return true;
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

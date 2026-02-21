import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ToastController, LoadingController } from '@ionic/angular';

@Component({
  selector: 'app-booking',
  templateUrl: './booking.page.html',
  styleUrls: ['./booking.page.scss'],
  standalone: false,
})
export class BookingPage implements OnInit {
  workerId: string = '';
  worker: any;
  loading = true;
  userData: any;

  bookingData = {
    serviceType: '',
    description: '',
    duration: 1,
    orderDate: new Date().toISOString(),
    totalAmount: 0
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) { }

  ngOnInit() {
    this.workerId = this.route.snapshot.paramMap.get('id') || '';
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      this.router.navigate(['/login']);
      return;
    }
    this.userData = JSON.parse(userStr);

    if (this.workerId) {
      this.loadWorker();
    } else {
      this.router.navigate(['/customer-dashboard']);
    }
  }

  loadWorker() {
    this.loading = true;
    this.apiService.getWorkerProfile(this.workerId).subscribe({
      next: (data) => {
        this.worker = data;
        this.bookingData.serviceType = data.skills?.[0] || 'General Maintenance';
        this.calculateTotal();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.showToast('Failed to load worker details', 'danger');
        this.router.navigate(['/customer-dashboard']);
      }
    });
  }

  calculateTotal() {
    if (this.worker) {
      this.bookingData.totalAmount = this.worker.hourlyRate * this.bookingData.duration;
    }
  }

  async confirmBooking() {
    if (!this.bookingData.serviceType || !this.bookingData.description) {
      this.showToast('Please fill in all details', 'warning');
      return;
    }

    // Pass booking details to payment page
    const navigationExtras = {
      state: {
        booking: {
          ...this.bookingData,
          workerId: this.workerId,
          customerId: this.userData.id || this.userData._id,
          workerName: this.worker.name || this.worker.username,
          customerName: this.userData.name || this.userData.username
        },
        worker: this.worker
      }
    };

    this.router.navigate(['/payment'], navigationExtras);
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

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-worker-details',
  templateUrl: './worker-details.page.html',
  styleUrls: ['./worker-details.page.scss'],
  standalone: false,
})
export class WorkerDetailsPage implements OnInit {
  workerId: string = '';
  worker: any;
  reviews: any[] = [];
  loading = true;
  activeTab = 'about';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private toastCtrl: ToastController
  ) { }

  ngOnInit() {
    this.workerId = this.route.snapshot.paramMap.get('id') || '';
    if (this.workerId) {
      this.loadWorkerData();
    } else {
      this.router.navigate(['/customer-dashboard']);
    }
  }

  async loadWorkerData() {
    this.loading = true;
    this.apiService.getWorkerProfile(this.workerId).subscribe({
      next: (data) => {
        this.worker = data;
        this.loadReviews();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.showToast('Failed to load worker details', 'danger');
        this.router.navigate(['/customer-dashboard']);
      }
    });
  }

  loadReviews() {
    this.apiService.getWorkerReviews(this.workerId).subscribe({
      next: (data) => {
        this.reviews = data;
      },
      error: () => console.error('Failed to load reviews')
    });
  }

  bookNow() {
    this.router.navigate(['/booking', this.workerId]);
  }

  openImage(img: string) {
    // Could integrate with a photo viewer
    console.log('Open image:', img);
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

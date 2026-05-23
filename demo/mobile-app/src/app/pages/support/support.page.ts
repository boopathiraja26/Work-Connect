import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ToastController, LoadingController } from '@ionic/angular';

@Component({
  selector: 'app-support',
  templateUrl: './support.page.html',
  styleUrls: ['./support.page.scss'],
  standalone: false,
})
export class SupportPage implements OnInit {
  activeTab = 'new';
  loading = false;
  userData: any;
  tickets: any[] = [];

  ticketData = {
    category: 'other',
    subject: '',
    description: ''
  };

  constructor(
    private apiService: ApiService,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) { }

  ngOnInit() {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      this.router.navigate(['/login']);
      return;
    }
    this.userData = JSON.parse(userStr);
    this.loadTickets();
  }

  loadTickets() {
    this.apiService.getUserTickets(this.userData.id || this.userData._id).subscribe({
      next: (data) => {
        this.tickets = data;
      },
      error: () => console.error('Failed to load tickets')
    });
  }

  async submitTicket() {
    if (!this.ticketData.subject || !this.ticketData.description) {
      this.showToast('Please fill in all fields', 'warning');
      return;
    }

    this.loading = true;
    const payload = {
      ...this.ticketData,
      userId: this.userData.id || this.userData._id,
      role: this.userData.role
    };

    this.apiService.createTicket(payload).subscribe({
      next: () => {
        this.loading = false;
        this.showToast('Ticket submitted successfully!', 'success');
        this.ticketData = { category: 'other', subject: '', description: '' };
        this.activeTab = 'history';
        this.loadTickets();
      },
      error: (err) => {
        this.loading = false;
        this.showToast(err.error?.message || 'Failed to submit ticket', 'danger');
      }
    });
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}

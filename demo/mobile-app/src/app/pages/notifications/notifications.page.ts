import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: false,
})
export class NotificationsPage implements OnInit {
  notifications: any[] = [];
  loading = true;
  userId: string = '';

  constructor(
    private apiService: ApiService,
    private toastCtrl: ToastController
  ) { }

  ngOnInit() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      this.userId = user.id || user._id;
      this.loadNotifications();
    }
  }

  loadNotifications() {
    this.loading = true;
    this.apiService.getNotifications(this.userId).subscribe({
      next: (data) => {
        this.notifications = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  markAsRead(notification: any) {
    if (notification.read) return;

    this.apiService.markNotificationRead(notification.id).subscribe({
      next: () => {
        notification.read = true;
      }
    });
  }

  doRefresh(event: any) {
    this.apiService.getNotifications(this.userId).subscribe({
      next: (data) => {
        this.notifications = data;
        event.target.complete();
      },
      error: () => event.target.complete()
    });
  }
}

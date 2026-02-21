import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ToastController, LoadingController } from '@ionic/angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  credentials = {
    username: '',
    password: ''
  };

  showPassword = false;
  loading = false;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) { }

  ngOnInit() {
    // Check if user is already logged in
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.role === 'worker') {
        this.router.navigate(['/worker-dashboard']);
      } else if (user.role === 'admin') {
        this.router.navigate(['/admin-dashboard']);
      } else {
        this.router.navigate(['/customer-dashboard']);
      }
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async onLogin() {
    if (!this.credentials.username || !this.credentials.password) {
      this.showToast('Please enter both username and password', 'warning');
      return;
    }

    this.loading = true;
    const loader = await this.loadingCtrl.create({
      message: 'Authenticating...',
      spinner: 'crescent'
    });
    await loader.present();

    this.apiService.login(this.credentials).subscribe({
      next: (res: any) => {
        this.loading = false;
        loader.dismiss();

        // Store user info
        localStorage.setItem('user', JSON.stringify(res.user));

        this.showToast('Welcome back, ' + (res.user.name || res.user.username) + '!', 'success');

        // Navigate based on role
        if (res.user.role === 'worker') {
          this.router.navigate(['/worker-dashboard']);
        } else if (res.user.role === 'admin') {
          this.router.navigate(['/admin-dashboard']);
        } else {
          this.router.navigate(['/customer-dashboard']);
        }
      },
      error: (err) => {
        this.loading = false;
        loader.dismiss();
        this.showToast(err.error?.message || 'Login failed. Please check your credentials.', 'danger');
      }
    });
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
      buttons: [
        {
          text: 'Dismiss',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  onForgotPassword() {
    this.showToast('Password reset is available in the web portal.', 'primary');
  }

  onRegister() {
    this.router.navigate(['/register']);
  }
}

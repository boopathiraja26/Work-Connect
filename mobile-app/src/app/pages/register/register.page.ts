import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ToastController, LoadingController, ActionSheetController } from '@ionic/angular';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false,
})
export class RegisterPage implements OnInit {
  step = 1;
  totalSteps = 4;
  loading = false;

  userData = {
    username: '',
    email: '',
    phone: '',
    password: '',
    role: '',
    address: {
      street: '',
      city: '',
      state: '',
      pincode: ''
    },
    aadhaarNumber: ''
  };

  otp = {
    email: '',
    phone: '',
    aadhaar: ''
  };

  emailVerified = false;
  phoneVerified = false;
  aadhaarVerified = false;
  profileImage: any = null;
  profileImageName = '';

  constructor(
    private apiService: ApiService,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private actionSheetCtrl: ActionSheetController
  ) { }

  ngOnInit() { }

  nextStep() {
    if (this.step === 1) {
      if (!this.userData.username || !this.userData.email || !this.userData.phone || !this.userData.password) {
        this.showToast('All fields are required', 'warning');
        return;
      }
      this.step++;
    } else if (this.step === 2) {
      if (!this.userData.role) {
        this.showToast('Please select a role', 'warning');
        return;
      }
      this.totalSteps = this.userData.role === 'worker' ? 5 : 4;
      this.sendOTPs();
      this.step++;
    } else if (this.step === 3) {
      if (!this.emailVerified || !this.phoneVerified) {
        this.showToast('Please verify your email and phone', 'warning');
        return;
      }
      this.step++;
    } else if (this.step === 4 && this.userData.role === 'worker') {
      // Aadhaar step is handled by confirmAadhaar()
      return;
    }
  }

  prevStep() {
    if (this.step > 1) this.step--;
  }

  async sendOTPs() {
    this.apiService.sendEmailOTP(this.userData.email, this.userData.role).subscribe({
      next: (res: any) => {
        this.showToast('Verification code sent to email', 'success');
        if (res.emailOtp) {
          console.log('DEMO Email OTP:', res.emailOtp);
          this.otp.email = res.emailOtp; // Auto-fill for convenience
        }
      }
    });

    this.apiService.sendPhoneOTP(this.userData.phone).subscribe({
      next: (res: any) => {
        this.showToast('Verification code sent to phone', 'success');
        if (res.phoneOtp) {
          console.log('DEMO Phone OTP:', res.phoneOtp);
          this.otp.phone = res.phoneOtp; // Auto-fill for convenience
        }
      }
    });
  }

  verifyEmail() {
    this.apiService.verifyEmailOTP({
      email: this.userData.email,
      emailOtp: this.otp.email,
      role: this.userData.role
    }).subscribe({
      next: () => {
        this.emailVerified = true;
        this.showToast('Email verified!', 'success');
        if (this.phoneVerified) this.step++;
      },
      error: () => this.showToast('Invalid Email OTP', 'danger')
    });
  }

  verifyPhone() {
    this.apiService.verifyPhoneOTP({
      phone: this.userData.phone,
      otp: this.otp.phone
    }).subscribe({
      next: () => {
        this.phoneVerified = true;
        this.showToast('Phone verified!', 'success');
        if (this.emailVerified) this.step++;
      },
      error: () => this.showToast('Invalid Phone OTP', 'danger')
    });
  }

  confirmAadhaar() {
    if (!this.userData.aadhaarNumber || this.userData.aadhaarNumber.toString().length !== 12) {
      this.showToast('Please enter a valid 12-digit Aadhaar number', 'warning');
      return;
    }
    this.aadhaarVerified = true;
    this.step++;
    this.showToast('Aadhaar number saved!', 'success');
  }

  async selectImage() {
    this.showToast('Camera Integration mocked.', 'primary');
    this.profileImageName = 'profile_photo.jpg';
  }

  async finishRegistration() {
    this.loading = true;
    const loader = await this.loadingCtrl.create({
      message: 'Creating account...',
    });
    await loader.present();

    const formData = new FormData();
    formData.append('username', this.userData.username);
    formData.append('email', this.userData.email);
    formData.append('phone', this.userData.phone);
    formData.append('password', this.userData.password);
    formData.append('role', this.userData.role);
    formData.append('address', JSON.stringify(this.userData.address));

    if (this.userData.role === 'worker') {
      formData.append('aadhaarNumber', this.userData.aadhaarNumber);
      formData.append('aadhaarOtp', this.otp.aadhaar);
    }

    formData.append('location', JSON.stringify({ link: '' }));

    this.apiService.register(formData).subscribe({
      next: () => {
        this.loading = false;
        loader.dismiss();
        this.showToast('Registration successful!', 'success');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.loading = false;
        loader.dismiss();
        this.showToast(err.error?.message || 'Registration failed', 'danger');
      }
    });
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

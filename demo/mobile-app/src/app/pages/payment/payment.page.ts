import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ToastController, LoadingController, AlertController } from '@ionic/angular';

declare var Razorpay: any;

@Component({
  selector: 'app-payment',
  templateUrl: './payment.page.html',
  styleUrls: ['./payment.page.scss'],
  standalone: false,
})
export class PaymentPage implements OnInit {
  booking: any;
  worker: any;
  paymentMethod = 'upi';
  processing = false;
  razorpayKey = '';

  constructor(
    private router: Router,
    private apiService: ApiService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController
  ) {
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras.state) {
      this.booking = nav.extras.state['booking'];
      this.worker = nav.extras.state['worker'];
    }
  }

  ngOnInit() {
    if (!this.booking) {
      this.router.navigate(['/customer-dashboard']);
      return;
    }
    this.fetchRazorpayKey();
  }

  fetchRazorpayKey() {
    this.apiService.getRazorpayKey().subscribe({
      next: (res) => this.razorpayKey = res.razorpayKeyId,
      error: () => console.warn('Razorpay key not found, fallback to simulation')
    });
  }

  async processPayment() {
    if (this.paymentMethod === 'card' && this.razorpayKey) {
      this.initiateRazorpay();
    } else {
      this.simulatePayment();
    }
  }

  async simulatePayment() {
    this.processing = true;
    const loader = await this.loadingCtrl.create({ message: 'Processing payment...' });
    await loader.present();

    setTimeout(async () => {
      this.createFinalOrder('SIMULATED_TXN_' + Date.now());
      loader.dismiss();
    }, 2000);
  }

  async initiateRazorpay() {
    this.processing = true;

    this.apiService.createRazorpayOrder(this.booking.totalAmount, 'WORKCONNECT_ORD_' + Date.now()).subscribe({
      next: (order: any) => {
        const options = {
          key: this.razorpayKey,
          amount: order.amount,
          currency: 'INR',
          name: 'WorkConnect',
          description: `Payment for ${this.booking.serviceType}`,
          order_id: order.id,
          handler: (response: any) => {
            this.verifyRazorpay(response);
          },
          prefill: {
            name: '', // Can fill from user storage
            email: '',
            contact: ''
          },
          theme: { color: '#3b82f6' },
          modal: {
            ondismiss: () => {
              this.processing = false;
              this.showToast('Payment cancelled', 'warning');
            }
          }
        };
        const rzp = new Razorpay(options);
        rzp.open();
      },
      error: (err) => {
        this.processing = false;
        this.showToast('Razorpay service unavailable. Using simulation...', 'warning');
        this.simulatePayment();
      }
    });
  }

  verifyRazorpay(response: any) {
    const data = {
      razorpay_order_id: response.razorpay_order_id,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature,
      orderId: this.booking.orderId || 'temp_id' // You'd ideally have a real ID here
    };

    this.apiService.verifyRazorpayPayment(data).subscribe({
      next: () => {
        this.createFinalOrder(response.razorpay_payment_id);
      },
      error: () => {
        this.processing = false;
        this.showToast('Payment verification failed', 'danger');
      }
    });
  }

  createFinalOrder(txnId: string) {
    const orderPayload = {
      customerId: this.booking.customerId,
      workerId: this.booking.workerId,
      serviceType: this.booking.serviceType,
      description: this.booking.description,
      duration: this.booking.duration.toString(),
      totalAmount: this.booking.totalAmount.toString(),
      orderDate: this.booking.orderDate,
      paymentStatus: 'paid',
      transactionId: txnId
    };

    this.apiService.createOrder(orderPayload).subscribe({
      next: async () => {
        this.processing = false;
        await this.showSuccessAlert();
      },
      error: (err) => {
        this.processing = false;
        this.showToast(err.error?.message || 'Failed to sync order', 'danger');
      }
    });
  }

  async showSuccessAlert() {
    const alert = await this.alertCtrl.create({
      header: 'Order Placed!',
      message: 'Payment received and order confirmed.',
      buttons: [
        {
          text: 'View Orders',
          handler: () => {
            this.router.navigate(['/customer-dashboard'], { queryParams: { tab: 'my-orders' } });
          }
        }
      ],
      backdropDismiss: false
    });
    await alert.present();
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

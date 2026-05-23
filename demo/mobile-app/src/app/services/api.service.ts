import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class ApiService {
    // Use the mobile-accessible IP address of your machine
    private apiUrl = 'https://workconnect-neon.vercel.app/api';

    constructor(private http: HttpClient) { }

    // Generic patterns based on the existing backend endpoints
    getWorkers(): Observable<any> {
        return this.http.get(`${this.apiUrl}/workers`);
    }

    getWorkerProfile(id: string): Observable<any> {
        return this.http.get(`${this.apiUrl}/worker/${id}`);
    }

    login(credentials: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/login`, credentials);
    }

    register(userData: FormData): Observable<any> {
        // For multipart/form-data (profile image), use FormData
        return this.http.post(`${this.apiUrl}/register`, userData);
    }

    // OTP Methods
    sendEmailOTP(email: string, role: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/send-email-otp`, { email, role });
    }

    verifyEmailOTP(data: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/verify-email-otp`, data);
    }

    sendPhoneOTP(phone: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/send-phone-otp`, { phone });
    }

    verifyPhoneOTP(data: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/verify-phone-otp`, data);
    }

    sendAadhaarOTP(data: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/send-aadhaar-otp`, data);
    }

    verifyAadhaarOTP(data: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/verify-aadhaar-otp`, data);
    }

    getOrders(userId: string): Observable<any> {
        return this.http.get(`${this.apiUrl}/orders/${userId}`);
    }

    updateOrderStatus(orderId: string, status: any): Observable<any> {
        return this.http.put(`${this.apiUrl}/orders/${orderId}`, status);
    }

    createOrder(orderData: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/orders`, orderData);
    }

    getWorkerReviews(workerId: string): Observable<any> {
        return this.http.get(`${this.apiUrl}/worker/${workerId}/reviews`);
    }

    // Admin Endpoints
    adminLogin(credentials: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/admin/login`, credentials);
    }

    getAdminWorkers(): Observable<any> {
        return this.http.get(`${this.apiUrl}/admin/workers`);
    }

    getAdminStats(): Observable<any> {
        return this.http.get(`${this.apiUrl}/admin/stats`);
    }

    getAdminOrders(): Observable<any> {
        return this.http.get(`${this.apiUrl}/admin/orders`);
    }

    approveWorker(workerId: string, status: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/admin/worker/${workerId}/approve`, { approved: status });
    }

    updateWorkerProfile(id: string, userData: FormData): Observable<any> {
        return this.http.put(`${this.apiUrl}/worker/${id}`, userData);
    }

    // Support Ticket Endpoints
    getAdminTickets(): Observable<any> {
        return this.http.get(`${this.apiUrl}/admin/support/tickets`);
    }

    resolveTicket(id: string, reply: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/admin/support/tickets/${id}/resolve`, { reply });
    }

    createTicket(ticketData: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/support/tickets`, ticketData);
    }

    getUserTickets(userId: string): Observable<any> {
        return this.http.get(`${this.apiUrl}/support/tickets/${userId}`);
    }

    // Razorpay Integration
    getRazorpayKey(): Observable<any> {
        return this.http.get(`${this.apiUrl}/get-razorpay-key`);
    }

    createRazorpayOrder(amount: number, orderId: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/create-razorpay-order`, { amount, orderId });
    }

    verifyRazorpayPayment(data: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/verify-razorpay-payment`, data);
    }

    // Notifications
    getNotifications(userId: string): Observable<any> {
        return this.http.get(`${this.apiUrl}/notifications/${userId}`);
    }

    markNotificationRead(id: string): Observable<any> {
        return this.http.put(`${this.apiUrl}/notifications/${id}/read`, {});
    }

    // Reviews
    addReview(workerId: string, reviewData: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/worker/${workerId}/reviews`, reviewData);
    }
}

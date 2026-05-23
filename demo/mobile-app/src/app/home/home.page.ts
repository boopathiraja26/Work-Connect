import { Component, OnInit } from '@angular/core';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  workers: any[] = [];

  constructor(private apiService: ApiService) { }

  ngOnInit() {
    this.loadWorkers();
  }

  loadWorkers() {
    this.apiService.getWorkers().subscribe({
      next: (data) => {
        this.workers = data;
      },
      error: (err) => {
        console.error('Error fetching workers', err);
      }
    });
  }
}

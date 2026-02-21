import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WorkerDashboardPage } from './worker-dashboard.page';

describe('WorkerDashboardPage', () => {
  let component: WorkerDashboardPage;
  let fixture: ComponentFixture<WorkerDashboardPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(WorkerDashboardPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

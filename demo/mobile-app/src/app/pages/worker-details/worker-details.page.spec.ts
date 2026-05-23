import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WorkerDetailsPage } from './worker-details.page';

describe('WorkerDetailsPage', () => {
  let component: WorkerDetailsPage;
  let fixture: ComponentFixture<WorkerDetailsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(WorkerDetailsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

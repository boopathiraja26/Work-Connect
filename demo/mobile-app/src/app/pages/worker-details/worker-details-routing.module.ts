import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { WorkerDetailsPage } from './worker-details.page';

const routes: Routes = [
  {
    path: '',
    component: WorkerDetailsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WorkerDetailsPageRoutingModule {}

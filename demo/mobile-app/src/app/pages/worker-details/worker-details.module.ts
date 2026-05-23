import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { WorkerDetailsPageRoutingModule } from './worker-details-routing.module';

import { WorkerDetailsPage } from './worker-details.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    WorkerDetailsPageRoutingModule
  ],
  declarations: [WorkerDetailsPage]
})
export class WorkerDetailsPageModule {}

import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { WorkOrderListComponent } from './features/work-orders/work-order-list.component';
import { WorkOrderFormComponent } from './features/work-orders/work-order-form.component';
import { WorkOrderDetailComponent } from './features/work-orders/work-order-detail.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'work-orders', component: WorkOrderListComponent },
  { path: 'work-orders/new', component: WorkOrderFormComponent },
  { path: 'work-orders/:id', component: WorkOrderDetailComponent },
  { path: '**', redirectTo: '' }
];

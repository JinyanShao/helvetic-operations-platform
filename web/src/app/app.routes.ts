import { Routes } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { WorkOrderListComponent } from './features/work-orders/work-order-list.component';
import { WorkOrderFormComponent } from './features/work-orders/work-order-form.component';
import { WorkOrderDetailComponent } from './features/work-orders/work-order-detail.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent, canActivate: [MsalGuard] },
  { path: 'work-orders', component: WorkOrderListComponent, canActivate: [MsalGuard] },
  { path: 'work-orders/new', component: WorkOrderFormComponent, canActivate: [MsalGuard] },
  { path: 'work-orders/:id', component: WorkOrderDetailComponent, canActivate: [MsalGuard] },
  { path: '**', redirectTo: '' }
];

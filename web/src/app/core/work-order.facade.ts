import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CancelWorkOrderRequest, Client, CreateWorkOrderRequest, SortDirection, TransitionWorkOrderRequest,
  UpdateWorkOrderRequest, WorkOrderDetail, WorkOrderListItemPagedResult, WorkOrderPriority,
  WorkOrderSort, WorkOrderStatus
} from '../api/generated/work-orders-api';

export interface WorkOrderListQuery {
  page?: number;
  pageSize?: number;
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  site?: string;
  slaRisk?: boolean;
  sort?: WorkOrderSort;
  direction?: SortDirection;
}

@Injectable({ providedIn: 'root' })
export class WorkOrderFacade {
  private readonly client = inject(Client);

  list(query: WorkOrderListQuery = {}): Observable<WorkOrderListItemPagedResult> {
    return this.client.listWorkOrders(query.page, query.pageSize, query.status, query.priority, query.site,
      query.slaRisk, query.sort, query.direction);
  }
  get(id: string): Observable<WorkOrderDetail> { return this.client.getWorkOrder(id); }
  create(request: CreateWorkOrderRequest): Observable<WorkOrderDetail> { return this.client.createWorkOrder(request); }
  update(id: string, request: UpdateWorkOrderRequest): Observable<WorkOrderDetail> { return this.client.updateWorkOrder(id, request); }
  transition(id: string, request: TransitionWorkOrderRequest): Observable<WorkOrderDetail> { return this.client.transitionWorkOrder(id, request); }
  cancel(id: string, request: CancelWorkOrderRequest): Observable<WorkOrderDetail> { return this.client.cancelWorkOrder(id, request); }
}

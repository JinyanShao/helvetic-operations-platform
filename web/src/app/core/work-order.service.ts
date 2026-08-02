import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { WorkOrder } from './work-order';

@Injectable({ providedIn: 'root' })
export class WorkOrderService {
  private readonly http = inject(HttpClient);
  list(): Observable<WorkOrder[]> { return this.http.get<WorkOrder[]>('/api/work-orders'); }
}

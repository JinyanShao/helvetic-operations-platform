import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { WorkOrder } from './work-order';
import { ENTRA_CONFIG } from './entra-config';

@Injectable({ providedIn: 'root' })
export class WorkOrderService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ENTRA_CONFIG);
  list(): Observable<WorkOrder[]> { return this.http.get<WorkOrder[]>(`${this.config.apiBaseUrl}/api/work-orders`); }
}

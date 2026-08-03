import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { WorkOrderListItem, WorkOrderStatus } from '../../api/generated/work-orders-api';
import { AuthService } from '../../core/auth.service';
import { WorkOrderFacade } from '../../core/work-order.facade';

@Component({
  selector: 'app-dashboard', standalone: true, imports: [DatePipe, RouterLink],
  templateUrl: './dashboard.component.html', styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly workOrders = inject(WorkOrderFacade);
  readonly activeFilter = signal<'All' | 'At risk'>('All');
  readonly navOpen = signal(false);
  readonly orders = signal<WorkOrderListItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly atRisk = computed(() => this.orders().filter(order => order.isSlaRisk));
  readonly activeCount = computed(() => this.orders().filter(order =>
    [WorkOrderStatus.Dispatched, WorkOrderStatus.InProgress, WorkOrderStatus.Blocked].includes(order.status!)).length);

  ngOnInit(): void { this.load(); }
  setFilter(filter: 'All' | 'At risk'): void { this.activeFilter.set(filter); this.load(); }
  load(): void {
    this.loading.set(true); this.error.set(null);
    this.workOrders.list({ pageSize: 4, slaRisk: this.activeFilter() === 'At risk' ? true : undefined })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({ next: result => this.orders.set(result.items ?? []), error: () => this.error.set('Operational data could not be loaded.') });
  }
  statusLabel(status?: WorkOrderStatus): string { return status?.replace('InProgress', 'In progress') ?? 'Unknown'; }
}

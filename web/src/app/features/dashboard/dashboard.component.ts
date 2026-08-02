import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { WorkOrder, WorkOrderStatus } from '../../core/work-order';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {
  readonly now = new Date('2026-08-02T08:42:00+02:00');
  readonly activeFilter = signal<'All' | 'At risk'>('All');
  readonly navOpen = signal(false);
  readonly orders = signal<WorkOrder[]>([
    { id: '1', reference: 'WO-2841', site: 'Zürich HB', summary: 'Platform lift safety inspection', priority: 'Critical', status: 'InProgress', dueAt: '2026-08-02T09:15:00+02:00', assignee: 'Lea Müller' },
    { id: '2', reference: 'WO-2847', site: 'Basel SBB', summary: 'Replace concourse access sensor', priority: 'Urgent', status: 'Dispatched', dueAt: '2026-08-02T10:30:00+02:00', assignee: 'Noah Frei' },
    { id: '3', reference: 'WO-2852', site: 'Bern', summary: 'North entrance lighting circuit', priority: 'Standard', status: 'Planned', dueAt: '2026-08-02T13:00:00+02:00' },
    { id: '4', reference: 'WO-2839', site: 'Lausanne', summary: 'Ventilation control anomaly', priority: 'Urgent', status: 'Blocked', dueAt: '2026-08-02T09:40:00+02:00', assignee: 'Mia Dubois' }
  ]);

  readonly atRisk = computed(() => this.orders().filter(order =>
    order.status !== 'Completed' && new Date(order.dueAt).getTime() <= this.now.getTime() + 2 * 60 * 60 * 1000));
  readonly visibleOrders = computed(() => this.activeFilter() === 'At risk' ? this.atRisk() : this.orders());
  readonly activeCount = computed(() => this.orders().filter(order => ['Dispatched', 'InProgress', 'Blocked'].includes(order.status)).length);

  statusLabel(status: WorkOrderStatus): string {
    return ({ Planned: 'Planned', Dispatched: 'Dispatched', InProgress: 'In progress', Blocked: 'Blocked', Completed: 'Completed' })[status];
  }
}

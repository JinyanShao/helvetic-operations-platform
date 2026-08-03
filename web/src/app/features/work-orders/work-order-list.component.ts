import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { SortDirection, WorkOrderListItem, WorkOrderPriority, WorkOrderSort, WorkOrderStatus } from '../../api/generated/work-orders-api';
import { WorkOrderFacade } from '../../core/work-order.facade';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-work-order-list', standalone: true, imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './work-order-list.component.html', styleUrl: './work-orders.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkOrderListComponent implements OnInit {
  private readonly facade = inject(WorkOrderFacade); private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router); private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  readonly canDispatch = this.auth.roles.some(role => role === 'Operations.Dispatcher' || role === 'Operations.Manager');
  readonly statuses = Object.values(WorkOrderStatus); readonly priorities = Object.values(WorkOrderPriority);
  readonly sorts = Object.values(WorkOrderSort); readonly directions = Object.values(SortDirection);
  readonly pageSizes = [10, 20, 50, 100];
  readonly rows = signal<WorkOrderListItem[]>([]); readonly loading = signal(true); readonly error = signal<string | null>(null);
  readonly page = signal(1); readonly totalPages = signal(0); readonly totalCount = signal(0);
  readonly filters = new FormGroup({
    status: new FormControl<WorkOrderStatus | ''>('', { nonNullable: true }),
    priority: new FormControl<WorkOrderPriority | ''>('', { nonNullable: true }),
    site: new FormControl('', { nonNullable: true }),
    slaRisk: new FormControl(false, { nonNullable: true }),
    sort: new FormControl(WorkOrderSort.DueAt, { nonNullable: true }),
    direction: new FormControl(SortDirection.Ascending, { nonNullable: true }),
    pageSize: new FormControl(10, { nonNullable: true })
  });

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.page.set(Math.max(1, Number(params.get('page')) || 1));
      this.filters.setValue({
        status: this.enumValue(WorkOrderStatus, params.get('status')) ?? '',
        priority: this.enumValue(WorkOrderPriority, params.get('priority')) ?? '',
        site: params.get('site') ?? '',
        slaRisk: params.get('slaRisk') === 'true',
        sort: this.enumValue(WorkOrderSort, params.get('sort')) ?? WorkOrderSort.DueAt,
        direction: this.enumValue(SortDirection, params.get('direction')) ?? SortDirection.Ascending,
        pageSize: this.pageSizes.includes(Number(params.get('pageSize'))) ? Number(params.get('pageSize')) : 10
      }, { emitEvent: false });
      this.load();
    });
  }
  applyFilters(): void { void this.navigate(1); }
  changePage(page: number): void { if (page >= 1 && page <= this.totalPages()) void this.navigate(page); }
  private navigate(page: number): Promise<boolean> {
    const value = this.filters.getRawValue();
    return this.router.navigate([], { relativeTo: this.route, queryParams: { page, status: value.status || null,
      priority: value.priority || null, site: value.site.trim() || null, slaRisk: value.slaRisk || null,
      sort: value.sort, direction: value.direction, pageSize: value.pageSize }, queryParamsHandling: 'merge' });
  }
  load(): void {
    this.loading.set(true); this.error.set(null); const value = this.filters.getRawValue();
    this.facade.list({ page: this.page(), pageSize: value.pageSize, status: value.status || undefined,
      priority: value.priority || undefined, site: value.site.trim() || undefined,
      slaRisk: value.slaRisk ? true : undefined, sort: value.sort, direction: value.direction })
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: result => { this.rows.set(result.items ?? []); this.totalPages.set(result.totalPages ?? 0); this.totalCount.set(result.totalCount ?? 0); },
        error: () => { this.rows.set([]); this.error.set('Work orders could not be loaded.'); } });
  }

  private enumValue<T extends string>(values: Record<string, T>, value: string | null): T | undefined {
    return value && Object.values(values).includes(value as T) ? value as T : undefined;
  }
}

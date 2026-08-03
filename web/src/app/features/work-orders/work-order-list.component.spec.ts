import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SortDirection, WorkOrderListItem, WorkOrderListItemPagedResult, WorkOrderPriority,
  WorkOrderSort, WorkOrderStatus
} from '../../api/generated/work-orders-api';
import { WorkOrderFacade } from '../../core/work-order.facade';
import { AuthService } from '../../core/auth.service';
import { WorkOrderListComponent } from './work-order-list.component';

describe('WorkOrderListComponent', () => {
  const queryParams = new BehaviorSubject(convertToParamMap({}));
  const list = vi.fn();
  const navigate = vi.fn().mockResolvedValue(true);
  let component: WorkOrderListComponent;

  const result = (items: WorkOrderListItem[] = [], totalPages = 0) => new WorkOrderListItemPagedResult({
    items, page: 1, pageSize: 10, totalCount: items.length, totalPages
  });

  beforeEach(() => {
    vi.clearAllMocks();
    queryParams.next(convertToParamMap({}));
    TestBed.configureTestingModule({ providers: [
      { provide: WorkOrderFacade, useValue: { list } },
      { provide: AuthService, useValue: { roles: ['Operations.Viewer'] } },
      { provide: ActivatedRoute, useValue: { queryParamMap: queryParams.asObservable() } },
      { provide: Router, useValue: { navigate } }
    ] });
    component = TestBed.runInInjectionContext(() => new WorkOrderListComponent());
  });

  it('keeps the loading state while the API request is pending', () => {
    list.mockReturnValue(new Subject<WorkOrderListItemPagedResult>());
    component.ngOnInit();
    expect(component.loading()).toBe(true);
  });

  it('shows a populated result', () => {
    const item = new WorkOrderListItem({ id: 'one', reference: 'WO-1' });
    list.mockReturnValue(of(result([item], 1)));
    component.ngOnInit();
    expect(component.rows()).toEqual([item]);
    expect(component.loading()).toBe(false);
  });

  it('represents an empty result without an error', () => {
    list.mockReturnValue(of(result()));
    component.ngOnInit();
    expect(component.rows()).toEqual([]);
    expect(component.error()).toBeNull();
  });

  it('exposes API failure and retries', () => {
    list.mockReturnValueOnce(throwError(() => new Error('offline'))).mockReturnValueOnce(of(result()));
    component.ngOnInit();
    expect(component.error()).toBe('Work orders could not be loaded.');
    component.load();
    expect(component.error()).toBeNull();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('restores URL state and maps it to the API request', () => {
    queryParams.next(convertToParamMap({ page: '3', pageSize: '50', status: 'Blocked', priority: 'Urgent',
      site: 'Demo Site', slaRisk: 'true', sort: 'Reference', direction: 'Descending' }));
    list.mockReturnValue(of(result()));
    component.ngOnInit();
    expect(component.page()).toBe(3);
    expect(component.filters.getRawValue()).toEqual({ pageSize: 50, status: WorkOrderStatus.Blocked,
      priority: WorkOrderPriority.Urgent, site: 'Demo Site', slaRisk: true,
      sort: WorkOrderSort.Reference, direction: SortDirection.Descending });
    expect(list).toHaveBeenCalledWith({ page: 3, pageSize: 50, status: WorkOrderStatus.Blocked,
      priority: WorkOrderPriority.Urgent, site: 'Demo Site', slaRisk: true,
      sort: WorkOrderSort.Reference, direction: SortDirection.Descending });
  });

  it('writes pagination and filters back to the URL', () => {
    list.mockReturnValue(of(result([], 4)));
    component.ngOnInit();
    component.totalPages.set(4);
    component.filters.setValue({ pageSize: 20, status: WorkOrderStatus.Planned,
      priority: WorkOrderPriority.Standard, site: '  Demo Site  ', slaRisk: true,
      sort: WorkOrderSort.CreatedAt, direction: SortDirection.Descending });
    component.changePage(2);
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: {
      page: 2, pageSize: 20, status: WorkOrderStatus.Planned, priority: WorkOrderPriority.Standard,
      site: 'Demo Site', slaRisk: true, sort: WorkOrderSort.CreatedAt, direction: SortDirection.Descending
    } }));
  });
});

import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CancelWorkOrderRequest,
  Client,
  CreateWorkOrderRequest,
  SortDirection,
  TransitionWorkOrderRequest,
  UpdateWorkOrderRequest,
  WorkOrderDetail,
  WorkOrderListItemPagedResult,
  WorkOrderPriority,
  WorkOrderSort,
  WorkOrderStatus
} from '../api/generated/work-orders-api';
import { WorkOrderFacade } from './work-order.facade';

describe('WorkOrderFacade', () => {
  const client = {
    listWorkOrders: vi.fn(),
    getWorkOrder: vi.fn(),
    createWorkOrder: vi.fn(),
    updateWorkOrder: vi.fn(),
    transitionWorkOrder: vi.fn(),
    cancelWorkOrder: vi.fn()
  };

  let facade: WorkOrderFacade;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [WorkOrderFacade, { provide: Client, useValue: client }] });
    facade = TestBed.inject(WorkOrderFacade);
  });

  it('passes list filters and paging to the generated client', async () => {
    const result = new WorkOrderListItemPagedResult({
      items: [], page: 2, pageSize: 25, totalCount: 0, totalPages: 0
    });
    client.listWorkOrders.mockReturnValue(of(result));

    await expect(firstValueFrom(facade.list({
      page: 2,
      pageSize: 25,
      status: WorkOrderStatus.Blocked,
      priority: WorkOrderPriority.Urgent,
      site: 'Demo Site',
      slaRisk: true,
      sort: WorkOrderSort.DueAt,
      direction: SortDirection.Descending
    }))).resolves.toBe(result);

    expect(client.listWorkOrders).toHaveBeenCalledWith(2, 25, WorkOrderStatus.Blocked,
      WorkOrderPriority.Urgent, 'Demo Site', true, WorkOrderSort.DueAt, SortDirection.Descending);
  });

  it('delegates commands without duplicating generated contracts', async () => {
    const detail = new WorkOrderDetail();
    const create = new CreateWorkOrderRequest();
    const update = new UpdateWorkOrderRequest();
    const transition = new TransitionWorkOrderRequest();
    const cancel = new CancelWorkOrderRequest();
    client.getWorkOrder.mockReturnValue(of(detail));
    client.createWorkOrder.mockReturnValue(of(detail));
    client.updateWorkOrder.mockReturnValue(of(detail));
    client.transitionWorkOrder.mockReturnValue(of(detail));
    client.cancelWorkOrder.mockReturnValue(of(detail));

    await firstValueFrom(facade.get('id'));
    await firstValueFrom(facade.create(create));
    await firstValueFrom(facade.update('id', update));
    await firstValueFrom(facade.transition('id', transition));
    await firstValueFrom(facade.cancel('id', cancel));

    expect(client.getWorkOrder).toHaveBeenCalledWith('id');
    expect(client.createWorkOrder).toHaveBeenCalledWith(create);
    expect(client.updateWorkOrder).toHaveBeenCalledWith('id', update);
    expect(client.transitionWorkOrder).toHaveBeenCalledWith('id', transition);
    expect(client.cancelWorkOrder).toHaveBeenCalledWith('id', cancel);
  });
});

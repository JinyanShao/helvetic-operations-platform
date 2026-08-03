import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiException, WorkOrderDetail, WorkOrderPriority, WorkOrderStatus } from '../../api/generated/work-orders-api';
import { WorkOrderFacade } from '../../core/work-order.facade';
import { AuthService } from '../../core/auth.service';
import { WorkOrderDetailComponent } from './work-order-detail.component';

describe('WorkOrderDetailComponent', () => {
  const get = vi.fn();
  const update = vi.fn(); const transition = vi.fn(); const cancel = vi.fn();
  let component: WorkOrderDetailComponent;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [
      { provide: WorkOrderFacade, useValue: { get, update, transition, cancel } },
      { provide: AuthService, useValue: { roles: ['Operations.Manager'] } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'work-order-id' }) } } }
    ] });
    component = TestBed.runInInjectionContext(() => new WorkOrderDetailComponent());
  });

  const detail = (version = 'AAAAAAAAAAA=', status = WorkOrderStatus.Planned) => new WorkOrderDetail({
    id: 'work-order-id', reference: 'WO-1', site: 'Demo Site', summary: 'Inspect lift',
    priority: WorkOrderPriority.Urgent, status, dueAt: new Date('2026-08-04T08:00:00Z'), version
  });

  it('loads work-order detail', () => {
    const item = detail();
    get.mockReturnValue(of(item));
    component.ngOnInit();
    expect(get).toHaveBeenCalledWith('work-order-id');
    expect(component.item()).toBe(item);
    expect(component.loading()).toBe(false);
  });

  it('represents a not-found response separately', () => {
    get.mockReturnValue(throwError(() => new ApiException('Not found', 404, '{}', {}, null)));
    component.ngOnInit();
    expect(component.notFound()).toBe(true);
    expect(component.error()).toBeNull();
    expect(component.item()).toBeNull();
  });

  it('updates editable fields with the current rowversion', () => {
    get.mockReturnValue(of(detail())); update.mockReturnValue(of(detail('AQAAAAAAAAA=')));
    component.ngOnInit(); component.form.patchValue({ summary: 'Updated lift' }); component.save();
    expect(update).toHaveBeenCalledWith('work-order-id', expect.objectContaining({
      summary: 'Updated lift', version: 'AAAAAAAAAAA='
    }));
    expect(component.item()?.version).toBe('AQAAAAAAAAA=');
    expect(component.saving()).toBe(false);
  });

  it('prevents duplicate edits while saving', () => {
    const pending = new Subject<WorkOrderDetail>();
    get.mockReturnValue(of(detail())); update.mockReturnValue(pending);
    component.ngOnInit(); component.save(); component.save();
    expect(component.saving()).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('advances status and refreshes detail state', () => {
    get.mockReturnValue(of(detail()));
    transition.mockReturnValue(of(detail('AgAAAAAAAAA=', WorkOrderStatus.Dispatched)));
    component.ngOnInit(); component.advance();
    expect(transition).toHaveBeenCalledWith('work-order-id', expect.objectContaining({
      targetStatus: WorkOrderStatus.Dispatched, version: 'AAAAAAAAAAA='
    }));
    expect(component.item()?.status).toBe(WorkOrderStatus.Dispatched);
  });

  it('requires a cancellation reason', () => {
    get.mockReturnValue(of(detail())); component.ngOnInit(); component.cancel();
    expect(component.cancellation.hasError('required')).toBe(true);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('allows a Manager to cancel and refreshes detail state', () => {
    get.mockReturnValue(of(detail()));
    cancel.mockReturnValue(of(detail('AwAAAAAAAAA=', WorkOrderStatus.Cancelled)));
    component.ngOnInit(); component.cancellation.setValue('No longer required'); component.cancel();
    expect(cancel).toHaveBeenCalledWith('work-order-id', expect.objectContaining({
      reason: 'No longer required', version: 'AAAAAAAAAAA='
    }));
    expect(component.item()?.status).toBe(WorkOrderStatus.Cancelled);
  });

  it('shows a conflict and reloads the latest version', () => {
    get.mockReturnValueOnce(of(detail())).mockReturnValueOnce(of(detail('BAAAAAAAAAA=')));
    update.mockReturnValue(throwError(() => new ApiException('Conflict', 409,
      JSON.stringify({ detail: 'Reload the work order.' }), {}, null)));
    component.ngOnInit(); component.save();
    expect(component.conflict()).toBe(true);
    expect(component.error()).toBe('Reload the work order.');
    component.load();
    expect(component.conflict()).toBe(false);
    expect(component.item()?.version).toBe('BAAAAAAAAAA=');
    expect(get).toHaveBeenCalledTimes(2);
  });
});

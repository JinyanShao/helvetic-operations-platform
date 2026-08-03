import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiException, WorkOrderDetail, WorkOrderPriority } from '../../api/generated/work-orders-api';
import { AuthService } from '../../core/auth.service';
import { WorkOrderFacade } from '../../core/work-order.facade';
import { WorkOrderFormComponent } from './work-order-form.component';

describe('WorkOrderFormComponent', () => {
  const create = vi.fn(); const navigate = vi.fn().mockResolvedValue(true);
  let component: WorkOrderFormComponent;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [
      { provide: WorkOrderFacade, useValue: { create } },
      { provide: Router, useValue: { navigate } },
      { provide: AuthService, useValue: { roles: ['Operations.Dispatcher'] } }
    ] });
    component = TestBed.runInInjectionContext(() => new WorkOrderFormComponent());
    component.form.setValue({ reference: 'WO-1', site: 'Demo Site', summary: 'Inspect lift',
      priority: WorkOrderPriority.Urgent, dueAt: '2026-08-04T08:00' });
  });

  it('creates and navigates to the returned detail', () => {
    create.mockReturnValue(of(new WorkOrderDetail({ id: 'created-id' })));
    component.submit();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ reference: 'WO-1' }));
    expect(navigate).toHaveBeenCalledWith(['/work-orders', 'created-id']);
    expect(component.saving()).toBe(false);
  });

  it('maps backend validation errors to controls', () => {
    create.mockReturnValue(throwError(() => new ApiException('Validation', 400,
      JSON.stringify({ title: 'Validation failed', errors: { Reference: ['Already exists.'] } }), {}, null)));
    component.submit();
    expect(component.form.controls.reference.getError('server')).toBe('Already exists.');
    expect(component.error()).toBe('Validation failed');
  });

  it('shows saving state and prevents duplicate submission', () => {
    create.mockReturnValue(new Subject<WorkOrderDetail>());
    component.submit(); component.submit();
    expect(component.saving()).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });
});

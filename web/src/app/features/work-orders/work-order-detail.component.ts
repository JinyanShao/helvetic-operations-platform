import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ApiException, CancelWorkOrderRequest, TransitionWorkOrderRequest, UpdateWorkOrderRequest,
  WorkOrderDetail, WorkOrderPriority, WorkOrderStatus } from '../../api/generated/work-orders-api';
import { WorkOrderFacade } from '../../core/work-order.facade';
import { AuthService } from '../../core/auth.service';
import { readApiProblem } from '../../core/api-error';

@Component({ selector: 'app-work-order-detail', standalone: true, imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './work-order-detail.component.html', styleUrl: './work-orders.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class WorkOrderDetailComponent implements OnInit {
  private readonly facade = inject(WorkOrderFacade); private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef); private readonly auth = inject(AuthService);
  readonly canDispatch = this.auth.roles.some(role => role === 'Operations.Dispatcher' || role === 'Operations.Manager');
  readonly canManage = this.auth.roles.includes('Operations.Manager');
  readonly item = signal<WorkOrderDetail | null>(null); readonly loading = signal(true);
  readonly saving = signal(false); readonly error = signal<string | null>(null); readonly notFound = signal(false);
  readonly conflict = signal(false); readonly editing = signal(false); readonly priorities = Object.values(WorkOrderPriority);
  readonly transitionTargets = computed(() => this.targetsFor(this.item()?.status));
  readonly form = new FormGroup({
    site: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    summary: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(300)] }),
    priority: new FormControl(WorkOrderPriority.Standard, { nonNullable: true }),
    dueAt: new FormControl('', { nonNullable: true, validators: Validators.required }),
    assignee: new FormControl('', { nonNullable: true, validators: Validators.maxLength(120) })
  });
  readonly transition = new FormGroup({ targetStatus: new FormControl(WorkOrderStatus.Dispatched, { nonNullable: true }),
    assignee: new FormControl('', { nonNullable: true, validators: Validators.maxLength(120) }) });
  readonly cancellation = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] });
  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true); this.error.set(null); this.notFound.set(false); this.conflict.set(false); this.item.set(null);
    this.facade.get(this.route.snapshot.paramMap.get('id')!)
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: item => { this.item.set(item); this.patch(item); }, error: error => {
        if (ApiException.isApiException(error) && error.status === 404) this.notFound.set(true);
        else this.error.set('Work order could not be loaded.');
      } });
  }
  save(): void {
    const item = this.item(); if (!this.canDispatch || !item || this.form.invalid || this.saving()) { this.form.markAllAsTouched(); return; }
    this.saving.set(true); this.error.set(null); const value = this.form.getRawValue();
    this.facade.update(item.id!, new UpdateWorkOrderRequest({ ...value, assignee: value.assignee || undefined,
      dueAt: new Date(value.dueAt), version: item.version }))
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: updated => { this.item.set(updated); this.editing.set(false); this.patch(updated); },
        error: error => this.applyProblem(error, this.form) });
  }
  advance(): void {
    const item = this.item(); if (!this.canDispatch || !item || this.transition.invalid || this.saving()) return;
    this.saving.set(true); this.error.set(null); const value = this.transition.getRawValue();
    this.facade.transition(item.id!, new TransitionWorkOrderRequest({ targetStatus: value.targetStatus,
      assignee: value.assignee || undefined, version: item.version }))
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: updated => { this.item.set(updated); this.patch(updated); },
        error: error => this.applyProblem(error, this.transition) });
  }
  cancel(): void {
    const item = this.item();
    if (!this.canManage || !item || this.cancellation.invalid || this.saving()) { this.cancellation.markAsTouched(); return; }
    this.saving.set(true); this.error.set(null);
    this.facade.cancel(item.id!, new CancelWorkOrderRequest({ reason: this.cancellation.value, version: item.version }))
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: updated => { this.item.set(updated); this.cancellation.reset(); this.patch(updated); },
        error: error => this.applyProblem(error) });
  }
  private patch(item: WorkOrderDetail): void {
    this.form.setValue({ site: item.site ?? '', summary: item.summary ?? '', priority: item.priority ?? WorkOrderPriority.Standard,
      dueAt: item.dueAt?.toISOString().slice(0, 16) ?? '', assignee: item.assignee ?? '' });
    const firstTarget = this.targetsFor(item.status)[0];
    if (firstTarget) this.transition.controls.targetStatus.setValue(firstTarget);
  }
  private applyProblem(error: unknown, form?: FormGroup): void {
    if (ApiException.isApiException(error) && error.status === 409) this.conflict.set(true);
    const problem = readApiProblem(error); this.error.set(problem.detail ?? problem.title ?? 'The operation failed.');
    for (const [name, messages] of Object.entries(problem.errors ?? {}))
      form?.get(name[0].toLowerCase() + name.slice(1))?.setErrors({ server: messages.join(' ') });
  }
  private targetsFor(status?: WorkOrderStatus): WorkOrderStatus[] {
    switch (status) {
      case WorkOrderStatus.Planned: return [WorkOrderStatus.Dispatched];
      case WorkOrderStatus.Dispatched: return [WorkOrderStatus.InProgress];
      case WorkOrderStatus.InProgress: return [WorkOrderStatus.Blocked, WorkOrderStatus.Completed];
      case WorkOrderStatus.Blocked: return [WorkOrderStatus.InProgress, WorkOrderStatus.Completed];
      default: return [];
    }
  }
}

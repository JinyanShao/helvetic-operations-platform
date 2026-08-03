import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { CreateWorkOrderRequest, WorkOrderPriority } from '../../api/generated/work-orders-api';
import { WorkOrderFacade } from '../../core/work-order.facade';
import { readApiProblem } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';

@Component({ selector: 'app-work-order-form', standalone: true, imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './work-order-form.component.html', styleUrl: './work-orders.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class WorkOrderFormComponent {
  private readonly facade = inject(WorkOrderFacade); private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef); private readonly auth = inject(AuthService);
  readonly canDispatch = this.auth.roles.some(role => role === 'Operations.Dispatcher' || role === 'Operations.Manager');
  readonly priorities = Object.values(WorkOrderPriority); readonly saving = signal(false); readonly error = signal<string | null>(null);
  readonly form = new FormGroup({ reference: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(24)] }),
    site: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    summary: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(300)] }),
    priority: new FormControl(WorkOrderPriority.Standard, { nonNullable: true, validators: Validators.required }),
    dueAt: new FormControl('', { nonNullable: true, validators: Validators.required }) });
  submit(): void {
    if (!this.canDispatch || this.form.invalid || this.saving()) { this.form.markAllAsTouched(); return; }
    this.saving.set(true); this.error.set(null); const value = this.form.getRawValue();
    this.facade.create(new CreateWorkOrderRequest({ ...value, dueAt: new Date(value.dueAt) }))
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({ next: item => void this.router.navigate(['/work-orders', item.id]),
        error: error => this.applyProblem(error) });
  }
  private applyProblem(error: unknown): void {
    const problem = readApiProblem(error); this.error.set(problem.detail ?? problem.title ?? 'The work order could not be created.');
    for (const [name, messages] of Object.entries(problem.errors ?? {})) {
      this.form.get(name[0].toLowerCase() + name.slice(1))?.setErrors({ server: messages.join(' ') });
    }
  }
}

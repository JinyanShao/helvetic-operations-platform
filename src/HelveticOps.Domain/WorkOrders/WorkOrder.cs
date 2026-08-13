namespace HelveticOps.Domain.WorkOrders;

public sealed class WorkOrderValidationException(string message, string parameterName)
    : ArgumentException(message, parameterName);

public sealed class WorkOrderInvalidTransitionException(string message)
    : InvalidOperationException(message);

public sealed class WorkOrder
{
    private WorkOrder() { }

    public WorkOrder(string reference, string site, string summary, WorkOrderPriority priority, DateTimeOffset dueAt, DateTimeOffset createdAt)
    {
        if (string.IsNullOrWhiteSpace(reference)) throw new WorkOrderValidationException("A reference is required.", nameof(reference));
        if (string.IsNullOrWhiteSpace(site)) throw new WorkOrderValidationException("A site is required.", nameof(site));
        if (string.IsNullOrWhiteSpace(summary)) throw new WorkOrderValidationException("A summary is required.", nameof(summary));
        EnsureDefinedPriority(priority);

        Id = Guid.NewGuid();
        Reference = reference.Trim().ToUpperInvariant();
        Site = site.Trim();
        Summary = summary.Trim();
        Priority = priority;
        DueAt = dueAt;
        Status = WorkOrderStatus.Planned;
        CreatedAt = createdAt;
        UpdatedAt = CreatedAt;
    }

    public Guid Id { get; private set; }
    public string Reference { get; private set; } = string.Empty;
    public string Site { get; private set; } = string.Empty;
    public string Summary { get; private set; } = string.Empty;
    public WorkOrderPriority Priority { get; private set; }
    public WorkOrderStatus Status { get; private set; }
    public DateTimeOffset DueAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public string? Assignee { get; private set; }
    public string? CancellationReason { get; private set; }
    public byte[] Version { get; private set; } = [];

    public bool IsAtRisk(DateTimeOffset now) =>
        Status is not (WorkOrderStatus.Completed or WorkOrderStatus.Cancelled) && DueAt <= now.AddHours(2);

    public void Update(string site, string summary, WorkOrderPriority priority, DateTimeOffset dueAt, string? assignee, DateTimeOffset changedAt)
    {
        EnsureOpen();
        if (string.IsNullOrWhiteSpace(site)) throw new WorkOrderValidationException("A site is required.", nameof(site));
        if (string.IsNullOrWhiteSpace(summary)) throw new WorkOrderValidationException("A summary is required.", nameof(summary));
        EnsureDefinedPriority(priority);
        Site = site.Trim();
        Summary = summary.Trim();
        Priority = priority;
        DueAt = dueAt;
        Assignee = string.IsNullOrWhiteSpace(assignee) ? null : assignee.Trim();
        UpdatedAt = changedAt;
    }

    public void DispatchTo(string assignee, DateTimeOffset changedAt)
    {
        if (Status is not WorkOrderStatus.Planned)
            throw new WorkOrderInvalidTransitionException("Only planned work orders can be dispatched.");
        if (string.IsNullOrWhiteSpace(assignee))
            throw new WorkOrderValidationException("An assignee is required.", nameof(assignee));

        Assignee = assignee.Trim();
        Status = WorkOrderStatus.Dispatched;
        UpdatedAt = changedAt;
    }

    public void Start(DateTimeOffset changedAt)
    {
        if (Status is not WorkOrderStatus.Dispatched)
            throw new WorkOrderInvalidTransitionException("Only dispatched work orders can be started.");
        Status = WorkOrderStatus.InProgress;
        UpdatedAt = changedAt;
    }

    public void Block(DateTimeOffset changedAt)
    {
        if (Status is not WorkOrderStatus.InProgress)
            throw new WorkOrderInvalidTransitionException("Only work in progress can be blocked.");
        Status = WorkOrderStatus.Blocked;
        UpdatedAt = changedAt;
    }

    public void Resume(DateTimeOffset changedAt)
    {
        if (Status is not WorkOrderStatus.Blocked)
            throw new WorkOrderInvalidTransitionException("Only blocked work orders can be resumed.");
        Status = WorkOrderStatus.InProgress;
        UpdatedAt = changedAt;
    }

    public void Complete(DateTimeOffset changedAt)
    {
        if (Status is not (WorkOrderStatus.InProgress or WorkOrderStatus.Blocked))
            throw new WorkOrderInvalidTransitionException("Only active work orders can be completed.");
        Status = WorkOrderStatus.Completed;
        UpdatedAt = changedAt;
    }

    public void Cancel(string reason, DateTimeOffset changedAt)
    {
        EnsureOpen();
        if (string.IsNullOrWhiteSpace(reason)) throw new WorkOrderValidationException("A cancellation reason is required.", nameof(reason));
        CancellationReason = reason.Trim();
        Status = WorkOrderStatus.Cancelled;
        UpdatedAt = changedAt;
    }

    public void AdvanceTo(WorkOrderStatus target, string? assignee, DateTimeOffset changedAt)
    {
        switch (target)
        {
            case WorkOrderStatus.Dispatched: DispatchTo(assignee ?? string.Empty, changedAt); break;
            case WorkOrderStatus.InProgress when Status is WorkOrderStatus.Dispatched: Start(changedAt); break;
            case WorkOrderStatus.InProgress when Status is WorkOrderStatus.Blocked: Resume(changedAt); break;
            case WorkOrderStatus.Blocked: Block(changedAt); break;
            case WorkOrderStatus.Completed: Complete(changedAt); break;
            default: throw new WorkOrderInvalidTransitionException($"The transition from {Status} to {target} is not allowed.");
        }
    }

    private void EnsureOpen()
    {
        if (Status is WorkOrderStatus.Completed or WorkOrderStatus.Cancelled)
            throw new WorkOrderInvalidTransitionException("Completed or cancelled work orders cannot be changed.");
    }

    private static void EnsureDefinedPriority(WorkOrderPriority priority)
    {
        if (!Enum.IsDefined(priority))
            throw new ArgumentOutOfRangeException(nameof(priority), priority, "The work-order priority is not defined.");
    }
}

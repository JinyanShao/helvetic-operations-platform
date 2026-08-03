namespace HelveticOps.Domain.WorkOrders;

public sealed class WorkOrder
{
    private WorkOrder() { }

    public WorkOrder(string reference, string site, string summary, WorkOrderPriority priority, DateTimeOffset dueAt, DateTimeOffset? createdAt = null)
    {
        if (string.IsNullOrWhiteSpace(reference)) throw new ArgumentException("A reference is required.", nameof(reference));
        if (string.IsNullOrWhiteSpace(site)) throw new ArgumentException("A site is required.", nameof(site));
        if (string.IsNullOrWhiteSpace(summary)) throw new ArgumentException("A summary is required.", nameof(summary));
        EnsureDefinedPriority(priority);

        Id = Guid.NewGuid();
        Reference = reference.Trim().ToUpperInvariant();
        Site = site.Trim();
        Summary = summary.Trim();
        Priority = priority;
        DueAt = dueAt;
        Status = WorkOrderStatus.Planned;
        CreatedAt = createdAt ?? DateTimeOffset.UtcNow;
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
        if (string.IsNullOrWhiteSpace(site)) throw new ArgumentException("A site is required.", nameof(site));
        if (string.IsNullOrWhiteSpace(summary)) throw new ArgumentException("A summary is required.", nameof(summary));
        EnsureDefinedPriority(priority);
        Site = site.Trim();
        Summary = summary.Trim();
        Priority = priority;
        DueAt = dueAt;
        Assignee = string.IsNullOrWhiteSpace(assignee) ? null : assignee.Trim();
        UpdatedAt = changedAt;
    }

    public void DispatchTo(string assignee, DateTimeOffset? changedAt = null)
    {
        if (Status is not WorkOrderStatus.Planned)
            throw new InvalidOperationException("Only planned work orders can be dispatched.");
        if (string.IsNullOrWhiteSpace(assignee))
            throw new ArgumentException("An assignee is required.", nameof(assignee));

        Assignee = assignee.Trim();
        Status = WorkOrderStatus.Dispatched;
        UpdatedAt = changedAt ?? DateTimeOffset.UtcNow;
    }

    public void Start(DateTimeOffset? changedAt = null)
    {
        if (Status is not WorkOrderStatus.Dispatched)
            throw new InvalidOperationException("Only dispatched work orders can be started.");
        Status = WorkOrderStatus.InProgress;
        UpdatedAt = changedAt ?? DateTimeOffset.UtcNow;
    }

    public void Block(DateTimeOffset? changedAt = null)
    {
        if (Status is not WorkOrderStatus.InProgress)
            throw new InvalidOperationException("Only work in progress can be blocked.");
        Status = WorkOrderStatus.Blocked;
        UpdatedAt = changedAt ?? DateTimeOffset.UtcNow;
    }

    public void Resume(DateTimeOffset? changedAt = null)
    {
        if (Status is not WorkOrderStatus.Blocked)
            throw new InvalidOperationException("Only blocked work orders can be resumed.");
        Status = WorkOrderStatus.InProgress;
        UpdatedAt = changedAt ?? DateTimeOffset.UtcNow;
    }

    public void Complete(DateTimeOffset? changedAt = null)
    {
        if (Status is not (WorkOrderStatus.InProgress or WorkOrderStatus.Blocked))
            throw new InvalidOperationException("Only active work orders can be completed.");
        Status = WorkOrderStatus.Completed;
        UpdatedAt = changedAt ?? DateTimeOffset.UtcNow;
    }

    public void Cancel(string reason, DateTimeOffset? changedAt = null)
    {
        EnsureOpen();
        if (string.IsNullOrWhiteSpace(reason)) throw new ArgumentException("A cancellation reason is required.", nameof(reason));
        CancellationReason = reason.Trim();
        Status = WorkOrderStatus.Cancelled;
        UpdatedAt = changedAt ?? DateTimeOffset.UtcNow;
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
            default: throw new InvalidOperationException($"The transition from {Status} to {target} is not allowed.");
        }
    }

    private void EnsureOpen()
    {
        if (Status is WorkOrderStatus.Completed or WorkOrderStatus.Cancelled)
            throw new InvalidOperationException("Completed or cancelled work orders cannot be changed.");
    }

    private static void EnsureDefinedPriority(WorkOrderPriority priority)
    {
        if (!Enum.IsDefined(priority))
            throw new ArgumentOutOfRangeException(nameof(priority), priority, "The work-order priority is not defined.");
    }
}

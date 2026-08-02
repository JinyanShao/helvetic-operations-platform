namespace HelveticOps.Domain.WorkOrders;

public sealed class WorkOrder
{
    private WorkOrder() { }

    public WorkOrder(string reference, string site, string summary, WorkOrderPriority priority, DateTimeOffset dueAt)
    {
        if (string.IsNullOrWhiteSpace(reference)) throw new ArgumentException("A reference is required.", nameof(reference));
        if (string.IsNullOrWhiteSpace(site)) throw new ArgumentException("A site is required.", nameof(site));
        if (string.IsNullOrWhiteSpace(summary)) throw new ArgumentException("A summary is required.", nameof(summary));

        Id = Guid.NewGuid();
        Reference = reference.Trim().ToUpperInvariant();
        Site = site.Trim();
        Summary = summary.Trim();
        Priority = priority;
        DueAt = dueAt;
        Status = WorkOrderStatus.Planned;
        CreatedAt = DateTimeOffset.UtcNow;
    }

    public Guid Id { get; private set; }
    public string Reference { get; private set; } = string.Empty;
    public string Site { get; private set; } = string.Empty;
    public string Summary { get; private set; } = string.Empty;
    public WorkOrderPriority Priority { get; private set; }
    public WorkOrderStatus Status { get; private set; }
    public DateTimeOffset DueAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public string? Assignee { get; private set; }

    public bool IsAtRisk(DateTimeOffset now) =>
        Status is not WorkOrderStatus.Completed && DueAt <= now.AddHours(2);

    public void DispatchTo(string assignee)
    {
        if (Status is not WorkOrderStatus.Planned)
            throw new InvalidOperationException("Only planned work orders can be dispatched.");
        if (string.IsNullOrWhiteSpace(assignee))
            throw new ArgumentException("An assignee is required.", nameof(assignee));

        Assignee = assignee.Trim();
        Status = WorkOrderStatus.Dispatched;
    }

    public void Start()
    {
        if (Status is not WorkOrderStatus.Dispatched)
            throw new InvalidOperationException("Only dispatched work orders can be started.");
        Status = WorkOrderStatus.InProgress;
    }

    public void Complete()
    {
        if (Status is not (WorkOrderStatus.InProgress or WorkOrderStatus.Blocked))
            throw new InvalidOperationException("Only active work orders can be completed.");
        Status = WorkOrderStatus.Completed;
    }
}

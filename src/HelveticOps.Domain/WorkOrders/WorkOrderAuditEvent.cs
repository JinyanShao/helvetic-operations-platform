namespace HelveticOps.Domain.WorkOrders;

public enum WorkOrderAuditEventType
{
    StatusChanged,
    Cancelled
}

public sealed class WorkOrderAuditEvent
{
    public const int ActorObjectIdMaxLength = 64;
    public const int ActorDisplayNameMaxLength = 160;
    public const int ReasonMaxLength = 500;

    private WorkOrderAuditEvent() { }

    public WorkOrderAuditEvent(Guid workOrderId, string eventType, WorkOrderStatus? fromStatus, WorkOrderStatus? toStatus,
        string? actorObjectId, string? actorDisplayName, DateTimeOffset occurredAt, string? reason = null)
        : this(workOrderId, ParseEventType(eventType), fromStatus, toStatus, actorObjectId, actorDisplayName, occurredAt, reason)
    {
    }

    public WorkOrderAuditEvent(Guid workOrderId, WorkOrderAuditEventType eventType, WorkOrderStatus? fromStatus,
        WorkOrderStatus? toStatus, string? actorObjectId, string? actorDisplayName, DateTimeOffset occurredAt,
        string? reason = null)
    {
        if (workOrderId == Guid.Empty)
        {
            throw new ArgumentException("Work order ID must not be empty.", nameof(workOrderId));
        }

        if (!Enum.IsDefined(eventType))
        {
            throw new ArgumentOutOfRangeException(nameof(eventType), eventType, "Audit event type must be defined.");
        }

        EnsureDefinedStatus(fromStatus, nameof(fromStatus));
        EnsureDefinedStatus(toStatus, nameof(toStatus));

        if (occurredAt.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Occurrence timestamp must use the UTC offset.", nameof(occurredAt));
        }

        Id = Guid.NewGuid();
        WorkOrderId = workOrderId;
        EventType = eventType;
        FromStatus = fromStatus;
        ToStatus = toStatus;
        ActorObjectId = NormalizeOptional(actorObjectId, ActorObjectIdMaxLength, nameof(actorObjectId));
        ActorDisplayName = NormalizeOptional(actorDisplayName, ActorDisplayNameMaxLength, nameof(actorDisplayName));
        OccurredAt = occurredAt;
        Reason = NormalizeOptional(reason, ReasonMaxLength, nameof(reason));
    }

    public Guid Id { get; private set; }
    public Guid WorkOrderId { get; private set; }
    public WorkOrderAuditEventType EventType { get; private set; }
    public WorkOrderStatus? FromStatus { get; private set; }
    public WorkOrderStatus? ToStatus { get; private set; }
    public string? ActorObjectId { get; private set; }
    public string? ActorDisplayName { get; private set; }
    public DateTimeOffset OccurredAt { get; private set; }
    public string? Reason { get; private set; }

    private static WorkOrderAuditEventType ParseEventType(string eventType)
    {
        if (string.IsNullOrWhiteSpace(eventType)
            || !Enum.TryParse<WorkOrderAuditEventType>(eventType, ignoreCase: false, out var parsed)
            || !Enum.IsDefined(parsed))
        {
            throw new ArgumentException("Audit event type must be a defined value.", nameof(eventType));
        }

        return parsed;
    }

    private static void EnsureDefinedStatus(WorkOrderStatus? status, string parameterName)
    {
        if (status.HasValue && !Enum.IsDefined(status.Value))
        {
            throw new ArgumentOutOfRangeException(parameterName, status, "Work order status must be defined.");
        }
    }

    private static string? NormalizeOptional(string? value, int maximumLength, string parameterName)
    {
        if (value is null)
        {
            return null;
        }

        var normalized = value.Trim();
        if (normalized.Length == 0)
        {
            return null;
        }

        if (normalized.Length > maximumLength)
        {
            throw new ArgumentException($"Value must not exceed {maximumLength} characters.", parameterName);
        }

        return normalized;
    }
}

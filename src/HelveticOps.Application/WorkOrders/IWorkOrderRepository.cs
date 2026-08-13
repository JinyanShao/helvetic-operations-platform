using HelveticOps.Domain.WorkOrders;
using System.Text.Json.Serialization;

namespace HelveticOps.Application.WorkOrders;

public interface IWorkOrderRepository
{
    Task<PagedResult<WorkOrderListItem>> QueryAsync(WorkOrderQuery query, DateTimeOffset now, CancellationToken cancellationToken);
    Task<WorkOrderDetail?> GetDetailAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken);
    Task<WorkOrder?> GetAsync(Guid id, bool tracking, CancellationToken cancellationToken);
    Task AddAsync(WorkOrder workOrder, CancellationToken cancellationToken);
    Task AddAuditEventAsync(WorkOrderAuditEvent auditEvent, CancellationToken cancellationToken);
    void SetOriginalVersion(WorkOrder workOrder, byte[] version);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}

public sealed record WorkOrderQuery
{
    public const int MaximumPageSize = 100;

    public WorkOrderQuery(int Page = 1, int PageSize = 20, WorkOrderStatus? Status = null,
        WorkOrderPriority? Priority = null, string? Site = null, bool? SlaRisk = null,
        WorkOrderSort Sort = WorkOrderSort.DueAt, SortDirection Direction = SortDirection.Ascending)
    {
        if (Page < 1) throw new ArgumentOutOfRangeException(nameof(Page), "Page must be at least 1.");
        if (PageSize is < 1 or > MaximumPageSize)
            throw new ArgumentOutOfRangeException(nameof(PageSize), $"Page size must be between 1 and {MaximumPageSize}.");
        if (Status.HasValue && !Enum.IsDefined(Status.Value))
            throw new ArgumentOutOfRangeException(nameof(Status), Status, "Status must be defined.");
        if (Priority.HasValue && !Enum.IsDefined(Priority.Value))
            throw new ArgumentOutOfRangeException(nameof(Priority), Priority, "Priority must be defined.");
        if (!Enum.IsDefined(Sort)) throw new ArgumentOutOfRangeException(nameof(Sort), Sort, "Sort must be defined.");
        if (!Enum.IsDefined(Direction))
            throw new ArgumentOutOfRangeException(nameof(Direction), Direction, "Sort direction must be defined.");

        this.Page = Page;
        this.PageSize = PageSize;
        this.Status = Status;
        this.Priority = Priority;
        this.Site = string.IsNullOrWhiteSpace(Site) ? null : Site.Trim();
        this.SlaRisk = SlaRisk;
        this.Sort = Sort;
        this.Direction = Direction;
    }

    public int Page { get; }
    public int PageSize { get; }
    public WorkOrderStatus? Status { get; }
    public WorkOrderPriority? Priority { get; }
    public string? Site { get; }
    public bool? SlaRisk { get; }
    public WorkOrderSort Sort { get; }
    public SortDirection Direction { get; }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum WorkOrderSort { DueAt, CreatedAt, UpdatedAt, Reference, Site, Priority, Status }
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum SortDirection { Ascending, Descending }

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount)
{
    public int TotalPages => TotalCount == 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public sealed record WorkOrderListItem(Guid Id, string Reference, string Site, string Summary,
    WorkOrderPriority Priority, WorkOrderStatus Status, DateTimeOffset DueAt, string? Assignee,
    bool IsSlaRisk, string Version);

public sealed record WorkOrderDetail(Guid Id, string Reference, string Site, string Summary,
    WorkOrderPriority Priority, WorkOrderStatus Status, DateTimeOffset DueAt, DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt, string? Assignee, string? CancellationReason, bool IsSlaRisk, string Version);

public sealed record AuditActor(string? ObjectId, string? DisplayName);

public sealed class WorkOrderNotFoundException(Guid id) : Exception($"Work order '{id}' was not found.");
public sealed class WorkOrderConcurrencyException(Guid id) : Exception($"Work order '{id}' changed after it was loaded.");
public sealed class WorkOrderVersionFormatException(string message, string parameterName, Exception? innerException = null)
    : ArgumentException(message, parameterName, innerException);

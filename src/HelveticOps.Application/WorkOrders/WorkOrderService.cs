using HelveticOps.Domain.WorkOrders;

namespace HelveticOps.Application.WorkOrders;

public sealed class WorkOrderService(IWorkOrderRepository repository, TimeProvider timeProvider)
{
    private DateTimeOffset Now => timeProvider.GetUtcNow();

    public Task<PagedResult<WorkOrderListItem>> ListAsync(WorkOrderQuery query, CancellationToken cancellationToken) =>
        repository.QueryAsync(query, Now, cancellationToken);

    public async Task<WorkOrderDetail> GetAsync(Guid id, CancellationToken cancellationToken) =>
        await repository.GetDetailAsync(id, Now, cancellationToken) ?? throw new WorkOrderNotFoundException(id);

    public async Task<WorkOrderDetail> CreateAsync(string reference, string site, string summary,
        WorkOrderPriority priority, DateTimeOffset dueAt, CancellationToken cancellationToken)
    {
        var now = Now;
        var workOrder = new WorkOrder(reference, site, summary, priority, dueAt, now);
        await repository.AddAsync(workOrder, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);
        return ToDetail(workOrder, now);
    }

    public async Task<WorkOrderDetail> UpdateAsync(Guid id, string site, string summary, WorkOrderPriority priority,
        DateTimeOffset dueAt, string? assignee, string version, CancellationToken cancellationToken)
    {
        var now = Now;
        var workOrder = await GetRequiredAsync(id, true, cancellationToken);
        repository.SetOriginalVersion(workOrder, DecodeVersion(version));
        workOrder.Update(site, summary, priority, dueAt, assignee, now);
        await repository.SaveChangesAsync(cancellationToken);
        return ToDetail(workOrder, now);
    }

    public async Task<WorkOrderDetail> AdvanceAsync(Guid id, WorkOrderStatus target, string? assignee, string version,
        AuditActor? actor, CancellationToken cancellationToken)
    {
        var now = Now;
        var workOrder = await GetRequiredAsync(id, true, cancellationToken);
        repository.SetOriginalVersion(workOrder, DecodeVersion(version));
        var previous = workOrder.Status;
        workOrder.AdvanceTo(target, assignee, now);
        await repository.AddAuditEventAsync(new WorkOrderAuditEvent(id, WorkOrderAuditEventType.StatusChanged,
            previous, target, actor?.ObjectId, actor?.DisplayName, now), cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);
        return ToDetail(workOrder, now);
    }

    public async Task<WorkOrderDetail> CancelAsync(Guid id, string reason, string version, AuditActor? actor,
        CancellationToken cancellationToken)
    {
        var now = Now;
        var workOrder = await GetRequiredAsync(id, true, cancellationToken);
        repository.SetOriginalVersion(workOrder, DecodeVersion(version));
        var previous = workOrder.Status;
        workOrder.Cancel(reason, now);
        await repository.AddAuditEventAsync(new WorkOrderAuditEvent(id, WorkOrderAuditEventType.Cancelled,
            previous, WorkOrderStatus.Cancelled, actor?.ObjectId, actor?.DisplayName, now, reason), cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);
        return ToDetail(workOrder, now);
    }

    private async Task<WorkOrder> GetRequiredAsync(Guid id, bool tracking, CancellationToken cancellationToken) =>
        await repository.GetAsync(id, tracking, cancellationToken) ?? throw new WorkOrderNotFoundException(id);

    private static byte[] DecodeVersion(string value)
    {
        try
        {
            var version = Convert.FromBase64String(value);
            return version.Length == 8
                ? version
                : throw new WorkOrderVersionFormatException("Version must represent an 8-byte SQL Server rowversion.", nameof(value));
        }
        catch (FormatException exception) { throw new WorkOrderVersionFormatException("Version must be a Base64 rowversion value.", nameof(value), exception); }
    }

    private static WorkOrderDetail ToDetail(WorkOrder item, DateTimeOffset now) =>
        new(item.Id, item.Reference, item.Site, item.Summary, item.Priority, item.Status, item.DueAt,
            item.CreatedAt, item.UpdatedAt, item.Assignee, item.CancellationReason, item.IsAtRisk(now),
            Convert.ToBase64String(item.Version));
}

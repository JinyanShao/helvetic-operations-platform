using HelveticOps.Application.WorkOrders;
using HelveticOps.Domain.WorkOrders;
using Microsoft.EntityFrameworkCore;

namespace HelveticOps.Infrastructure.Persistence;

public sealed class WorkOrderRepository(OperationsDbContext dbContext) : IWorkOrderRepository
{
    public async Task<PagedResult<WorkOrderListItem>> QueryAsync(WorkOrderQuery query, DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var source = dbContext.WorkOrders.AsNoTracking();
        if (query.Status is not null) source = source.Where(x => x.Status == query.Status);
        if (query.Priority is not null) source = source.Where(x => x.Priority == query.Priority);
        if (!string.IsNullOrWhiteSpace(query.Site)) source = source.Where(x => x.Site == query.Site.Trim());
        if (query.SlaRisk is not null)
        {
            var threshold = now.AddHours(2);
            source = query.SlaRisk.Value
                ? source.Where(x => x.Status != WorkOrderStatus.Completed && x.Status != WorkOrderStatus.Cancelled && x.DueAt <= threshold)
                : source.Where(x => x.Status == WorkOrderStatus.Completed || x.Status == WorkOrderStatus.Cancelled || x.DueAt > threshold);
        }

        source = ApplyOrdering(source, query.Sort, query.Direction);
        var total = await source.CountAsync(cancellationToken);
        var rows = await source.Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .Select(x => new WorkOrderListRow(x.Id, x.Reference, x.Site, x.Summary, x.Priority, x.Status,
                x.DueAt, x.Assignee, x.Version))
            .ToListAsync(cancellationToken);
        var thresholdAt = now.AddHours(2);
        var items = rows.Select(x => new WorkOrderListItem(x.Id, x.Reference, x.Site, x.Summary, x.Priority,
            x.Status, x.DueAt, x.Assignee, x.Status is not (WorkOrderStatus.Completed or WorkOrderStatus.Cancelled) && x.DueAt <= thresholdAt,
            Convert.ToBase64String(x.Version))).ToList();
        return new PagedResult<WorkOrderListItem>(items, query.Page, query.PageSize, total);
    }

    public Task<WorkOrder?> GetAsync(Guid id, bool tracking, CancellationToken cancellationToken)
    {
        var query = tracking ? dbContext.WorkOrders : dbContext.WorkOrders.AsNoTracking();
        return query.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
    }

    public async Task<WorkOrderDetail?> GetDetailAsync(Guid id, DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var row = await dbContext.WorkOrders.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new WorkOrderDetailRow(x.Id, x.Reference, x.Site, x.Summary, x.Priority, x.Status,
                x.DueAt, x.CreatedAt, x.UpdatedAt, x.Assignee, x.CancellationReason, x.Version))
            .SingleOrDefaultAsync(cancellationToken);

        return row is null
            ? null
            : new WorkOrderDetail(row.Id, row.Reference, row.Site, row.Summary, row.Priority, row.Status,
                row.DueAt, row.CreatedAt, row.UpdatedAt, row.Assignee, row.CancellationReason,
                row.Status is not (WorkOrderStatus.Completed or WorkOrderStatus.Cancelled) && row.DueAt <= now.AddHours(2),
                Convert.ToBase64String(row.Version));
    }

    public Task AddAsync(WorkOrder workOrder, CancellationToken cancellationToken) =>
        dbContext.WorkOrders.AddAsync(workOrder, cancellationToken).AsTask();

    public Task AddAuditEventAsync(WorkOrderAuditEvent auditEvent, CancellationToken cancellationToken) =>
        dbContext.WorkOrderAuditEvents.AddAsync(auditEvent, cancellationToken).AsTask();

    public void SetOriginalVersion(WorkOrder workOrder, byte[] version) =>
        dbContext.Entry(workOrder).Property(x => x.Version).OriginalValue = version;

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        try { await dbContext.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException exception)
        {
            var id = exception.Entries.Select(entry => entry.Entity).OfType<WorkOrder>().Select(x => x.Id).FirstOrDefault();
            throw new WorkOrderConcurrencyException(id);
        }
    }

    private static IQueryable<WorkOrder> ApplyOrdering(IQueryable<WorkOrder> source, WorkOrderSort sort, SortDirection direction) =>
        (sort, direction) switch
        {
            (WorkOrderSort.CreatedAt, SortDirection.Ascending) => source.OrderBy(x => x.CreatedAt).ThenBy(x => x.Id),
            (WorkOrderSort.CreatedAt, SortDirection.Descending) => source.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id),
            (WorkOrderSort.UpdatedAt, SortDirection.Ascending) => source.OrderBy(x => x.UpdatedAt).ThenBy(x => x.Id),
            (WorkOrderSort.UpdatedAt, SortDirection.Descending) => source.OrderByDescending(x => x.UpdatedAt).ThenBy(x => x.Id),
            (WorkOrderSort.Reference, SortDirection.Ascending) => source.OrderBy(x => x.Reference).ThenBy(x => x.Id),
            (WorkOrderSort.Reference, SortDirection.Descending) => source.OrderByDescending(x => x.Reference).ThenBy(x => x.Id),
            (WorkOrderSort.Site, SortDirection.Ascending) => source.OrderBy(x => x.Site).ThenBy(x => x.Id),
            (WorkOrderSort.Site, SortDirection.Descending) => source.OrderByDescending(x => x.Site).ThenBy(x => x.Id),
            (WorkOrderSort.Priority, SortDirection.Ascending) => source.OrderBy(x => x.Priority).ThenBy(x => x.Id),
            (WorkOrderSort.Priority, SortDirection.Descending) => source.OrderByDescending(x => x.Priority).ThenBy(x => x.Id),
            (WorkOrderSort.Status, SortDirection.Ascending) => source.OrderBy(x => x.Status).ThenBy(x => x.Id),
            (WorkOrderSort.Status, SortDirection.Descending) => source.OrderByDescending(x => x.Status).ThenBy(x => x.Id),
            (WorkOrderSort.DueAt, SortDirection.Descending) => source.OrderByDescending(x => x.DueAt).ThenBy(x => x.Id),
            _ => source.OrderBy(x => x.DueAt).ThenBy(x => x.Id)
        };

    private sealed record WorkOrderListRow(Guid Id, string Reference, string Site, string Summary,
        WorkOrderPriority Priority, WorkOrderStatus Status, DateTimeOffset DueAt, string? Assignee, byte[] Version);

    private sealed record WorkOrderDetailRow(Guid Id, string Reference, string Site, string Summary,
        WorkOrderPriority Priority, WorkOrderStatus Status, DateTimeOffset DueAt, DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt, string? Assignee, string? CancellationReason, byte[] Version);
}

using HelveticOps.Domain.WorkOrders;

namespace HelveticOps.Application.WorkOrders;

public sealed class WorkOrderService(IWorkOrderRepository repository)
{
    public Task<IReadOnlyList<WorkOrder>> ListAsync(CancellationToken cancellationToken) =>
        repository.ListAsync(cancellationToken);

    public async Task<WorkOrder> CreateAsync(
        string reference,
        string site,
        string summary,
        WorkOrderPriority priority,
        DateTimeOffset dueAt,
        CancellationToken cancellationToken)
    {
        var workOrder = new WorkOrder(reference, site, summary, priority, dueAt);
        await repository.AddAsync(workOrder, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);
        return workOrder;
    }
}

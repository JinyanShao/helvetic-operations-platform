using HelveticOps.Domain.WorkOrders;

namespace HelveticOps.Application.WorkOrders;

public interface IWorkOrderRepository
{
    Task<IReadOnlyList<WorkOrder>> ListAsync(CancellationToken cancellationToken);
    Task AddAsync(WorkOrder workOrder, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}

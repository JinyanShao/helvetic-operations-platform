using HelveticOps.Application.WorkOrders;
using HelveticOps.Domain.WorkOrders;
using Microsoft.EntityFrameworkCore;

namespace HelveticOps.Infrastructure.Persistence;

public sealed class WorkOrderRepository(OperationsDbContext dbContext) : IWorkOrderRepository
{
    public async Task<IReadOnlyList<WorkOrder>> ListAsync(CancellationToken cancellationToken) =>
        await dbContext.WorkOrders.AsNoTracking().OrderBy(x => x.DueAt).ToListAsync(cancellationToken);

    public Task AddAsync(WorkOrder workOrder, CancellationToken cancellationToken) =>
        dbContext.WorkOrders.AddAsync(workOrder, cancellationToken).AsTask();

    public async Task SaveChangesAsync(CancellationToken cancellationToken) =>
        await dbContext.SaveChangesAsync(cancellationToken);
}

using HelveticOps.Application.WorkOrders;
using HelveticOps.Domain.WorkOrders;
using HelveticOps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HelveticOps.Api.Tests;

[Collection(SqlServerCollection.Name)]
public sealed class WorkOrderRepositoryTests(SqlServerFixture database) : IAsyncLifetime
{
    public Task InitializeAsync() => database.ResetAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Query_applies_filters_sorting_and_pagination_in_sql_server()
    {
        await using var db = database.CreateContext();
        var now = new DateTimeOffset(2026, 8, 3, 8, 0, 0, TimeSpan.Zero);
        db.WorkOrders.AddRange(
            new WorkOrder("WO-3", "Bern", "Third", WorkOrderPriority.Urgent, now.AddHours(1), now),
            new WorkOrder("WO-2", "Bern", "Second", WorkOrderPriority.Urgent, now.AddMinutes(30), now),
            new WorkOrder("WO-1", "Zürich", "First", WorkOrderPriority.Standard, now.AddHours(4), now));
        await db.SaveChangesAsync();
        var repository = new WorkOrderRepository(db);

        var result = await repository.QueryAsync(new WorkOrderQuery(1, 1, Priority: WorkOrderPriority.Urgent,
            Site: "Bern", SlaRisk: true, Sort: WorkOrderSort.Reference, Direction: SortDirection.Descending), now, default);

        Assert.Equal(2, result.TotalCount);
        Assert.Single(result.Items);
        Assert.Equal("WO-3", result.Items[0].Reference);
    }

    [Fact]
    public async Task Stale_rowversion_throws_and_rolls_back_audit_event()
    {
        var now = DateTimeOffset.UtcNow;
        Guid id;
        await using (var setup = database.CreateContext())
        {
            var order = new WorkOrder("WO-C1", "Bern", "Concurrency", WorkOrderPriority.Critical, now.AddHours(1), now);
            setup.Add(order);
            await setup.SaveChangesAsync();
            id = order.Id;
        }
        await using var firstDb = database.CreateContext();
        await using var secondDb = database.CreateContext();
        var first = await firstDb.WorkOrders.SingleAsync(x => x.Id == id);
        var second = await secondDb.WorkOrders.SingleAsync(x => x.Id == id);
        first.DispatchTo("First", now);
        second.DispatchTo("Second", now);
        firstDb.WorkOrderAuditEvents.Add(new WorkOrderAuditEvent(id, "StatusChanged", WorkOrderStatus.Planned,
            WorkOrderStatus.Dispatched, "one", "First", now));
        secondDb.WorkOrderAuditEvents.Add(new WorkOrderAuditEvent(id, "StatusChanged", WorkOrderStatus.Planned,
            WorkOrderStatus.Dispatched, "two", "Second", now));
        await firstDb.SaveChangesAsync();

        var secondRepository = new WorkOrderRepository(secondDb);
        await Assert.ThrowsAsync<WorkOrderConcurrencyException>(() => secondRepository.SaveChangesAsync(default));
        await using var verify = database.CreateContext();
        Assert.Equal("First", (await verify.WorkOrders.SingleAsync(x => x.Id == id)).Assignee);
        Assert.Equal(1, await verify.WorkOrderAuditEvents.CountAsync(x => x.WorkOrderId == id));
    }

    [Fact]
    public async Task Migration_creates_expected_schema_from_empty_database()
    {
        await using var db = database.CreateContext();
        var migrations = await db.Database.GetAppliedMigrationsAsync();
        Assert.Contains(migrations, name => name.EndsWith("InitialWorkOrders", StringComparison.Ordinal));
        Assert.True(await db.Database.CanConnectAsync());
    }
}

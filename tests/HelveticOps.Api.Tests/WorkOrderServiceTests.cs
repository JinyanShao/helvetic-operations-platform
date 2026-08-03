using HelveticOps.Application.WorkOrders;
using HelveticOps.Domain.WorkOrders;
using NSubstitute;
using Xunit;

namespace HelveticOps.Api.Tests;

public sealed class WorkOrderServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 3, 8, 0, 0, TimeSpan.Zero);
    private readonly IWorkOrderRepository repository = Substitute.For<IWorkOrderRepository>();

    [Fact]
    public async Task Create_adds_and_saves_work_order()
    {
        var service = new WorkOrderService(repository, new FixedTimeProvider(Now));
        var result = await service.CreateAsync("wo-42", "Bern", "Inspect lift", WorkOrderPriority.Urgent,
            Now.AddHours(4), default);
        Assert.Equal("WO-42", result.Reference);
        await repository.Received(1).AddAsync(Arg.Any<WorkOrder>(), Arg.Any<CancellationToken>());
        await repository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Missing_work_order_raises_not_found()
    {
        repository.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns((WorkOrderDetail?)null);
        var service = new WorkOrderService(repository, new FixedTimeProvider(Now));
        await Assert.ThrowsAsync<WorkOrderNotFoundException>(() => service.GetAsync(Guid.NewGuid(), default));
    }

    [Fact]
    public void Query_rejects_oversized_pages_and_unknown_sort_values()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new WorkOrderQuery(PageSize: 101));
        Assert.Throws<ArgumentOutOfRangeException>(() => new WorkOrderQuery(Sort: (WorkOrderSort)999));
    }

    [Fact]
    public async Task Transition_without_actor_records_a_nullable_actor_audit_event()
    {
        var order = new WorkOrder("WO-43", "Demo Site", "Inspect lift", WorkOrderPriority.Urgent,
            Now.AddHours(4), Now);
        repository.GetAsync(order.Id, true, Arg.Any<CancellationToken>()).Returns(order);
        var service = new WorkOrderService(repository, new FixedTimeProvider(Now));

        await service.AdvanceAsync(order.Id, WorkOrderStatus.Dispatched, "Demo Technician",
            Convert.ToBase64String(new byte[8]), null, default);

        await repository.Received(1).AddAuditEventAsync(
            Arg.Is<WorkOrderAuditEvent>(auditEvent =>
                auditEvent.EventType == WorkOrderAuditEventType.StatusChanged
                && auditEvent.FromStatus == WorkOrderStatus.Planned
                && auditEvent.ToStatus == WorkOrderStatus.Dispatched
                && auditEvent.ActorObjectId == null
                && auditEvent.ActorDisplayName == null),
            Arg.Any<CancellationToken>());
        await repository.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    private sealed class FixedTimeProvider(DateTimeOffset value) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => value;
    }
}

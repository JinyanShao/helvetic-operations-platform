using FluentAssertions;
using HelveticOps.Domain.WorkOrders;
using Xunit;

namespace HelveticOps.Domain.Tests;

public sealed class WorkOrderTests
{
    [Fact]
    public void Dispatching_a_planned_order_assigns_the_operator()
    {
        var order = NewOrder();

        order.DispatchTo("Lea Müller");

        order.Status.Should().Be(WorkOrderStatus.Dispatched);
        order.Assignee.Should().Be("Lea Müller");
    }

    [Fact]
    public void Starting_an_undispatched_order_is_rejected()
    {
        var order = NewOrder();

        Action act = () => order.Start();

        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void A_due_active_order_is_at_risk()
    {
        var now = DateTimeOffset.UtcNow;
        var order = NewOrder(now.AddMinutes(45));

        order.IsAtRisk(now).Should().BeTrue();
    }

    private static WorkOrder NewOrder(DateTimeOffset? dueAt = null) =>
        new("WO-2048", "Zürich HB", "Inspect platform lift", WorkOrderPriority.Urgent, dueAt ?? DateTimeOffset.UtcNow.AddHours(8));
}

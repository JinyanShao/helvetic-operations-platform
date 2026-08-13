using FluentAssertions;
using HelveticOps.Domain.WorkOrders;
using Xunit;

namespace HelveticOps.Domain.Tests;

public sealed class WorkOrderTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 3, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Dispatching_a_planned_order_assigns_the_operator()
    {
        var order = NewOrder();

        order.DispatchTo("Lea Müller", Now);

        order.Status.Should().Be(WorkOrderStatus.Dispatched);
        order.Assignee.Should().Be("Lea Müller");
    }

    [Fact]
    public void Starting_an_undispatched_order_is_rejected()
    {
        var order = NewOrder();

        Action act = () => order.Start(Now);

        act.Should().Throw<WorkOrderInvalidTransitionException>();
    }

    [Fact]
    public void A_due_active_order_is_at_risk()
    {
        var now = Now;
        var order = NewOrder(now.AddMinutes(45));

        order.IsAtRisk(now).Should().BeTrue();
    }

    private static WorkOrder NewOrder(DateTimeOffset? dueAt = null) =>
        new("WO-2048", "Zürich HB", "Inspect platform lift", WorkOrderPriority.Urgent, dueAt ?? Now.AddHours(8), Now);
}

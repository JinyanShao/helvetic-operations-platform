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
    public void Planned_order_can_flow_to_completed_through_valid_transitions()
    {
        var order = NewOrder();

        order.DispatchTo("Lea Müller", Now.AddMinutes(5));
        order.Start(Now.AddMinutes(10));
        order.Complete(Now.AddMinutes(15));

        order.Status.Should().Be(WorkOrderStatus.Completed);
        order.Assignee.Should().Be("Lea Müller");
        order.UpdatedAt.Should().Be(Now.AddMinutes(15));
    }

    [Fact]
    public void Blocked_order_can_resume_back_to_in_progress()
    {
        var order = NewOrder();
        order.DispatchTo("Lea Müller", Now.AddMinutes(5));
        order.Start(Now.AddMinutes(10));

        order.Block(Now.AddMinutes(15));
        order.Resume(Now.AddMinutes(20));

        order.Status.Should().Be(WorkOrderStatus.InProgress);
        order.UpdatedAt.Should().Be(Now.AddMinutes(20));
    }

    [Fact]
    public void Completed_order_cannot_be_changed()
    {
        var order = NewOrder();
        order.DispatchTo("Lea Müller", Now.AddMinutes(5));
        order.Start(Now.AddMinutes(10));
        order.Complete(Now.AddMinutes(15));

        Action act = () => order.Update("Bern", "Updated summary", WorkOrderPriority.Standard, Now.AddHours(2), "Lea Müller", Now.AddMinutes(20));

        act.Should().Throw<WorkOrderInvalidTransitionException>()
            .WithMessage("Completed or cancelled work orders cannot be changed.");
    }

    [Fact]
    public void Cancel_requires_a_reason()
    {
        var order = NewOrder();

        Action act = () => order.Cancel("   ", Now.AddMinutes(5));

        act.Should().Throw<WorkOrderValidationException>()
            .WithMessage("A cancellation reason is required. (Parameter 'reason')");
    }

    [Fact]
    public void Advance_to_in_progress_from_planned_is_rejected()
    {
        var order = NewOrder();

        Action act = () => order.AdvanceTo(WorkOrderStatus.InProgress, null, Now.AddMinutes(5));

        act.Should().Throw<WorkOrderInvalidTransitionException>()
            .WithMessage("The transition from Planned to InProgress is not allowed.");
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

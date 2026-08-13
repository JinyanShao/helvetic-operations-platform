using FluentAssertions;
using HelveticOps.Domain.WorkOrders;
using Xunit;

namespace HelveticOps.Domain.Tests;

public sealed class WorkOrderTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 3, 8, 0, 0, TimeSpan.Zero);

    public static TheoryData<WorkOrderStatus, WorkOrderStatus, string> InvalidTransitions =>
        new()
        {
            { WorkOrderStatus.Planned, WorkOrderStatus.InProgress, "The transition from Planned to InProgress is not allowed." },
            { WorkOrderStatus.Planned, WorkOrderStatus.Blocked, "Only work in progress can be blocked." },
            { WorkOrderStatus.Planned, WorkOrderStatus.Completed, "Only active work orders can be completed." },
            { WorkOrderStatus.Dispatched, WorkOrderStatus.Blocked, "Only work in progress can be blocked." },
            { WorkOrderStatus.Dispatched, WorkOrderStatus.Completed, "Only active work orders can be completed." },
            { WorkOrderStatus.InProgress, WorkOrderStatus.Dispatched, "Only planned work orders can be dispatched." },
            { WorkOrderStatus.Blocked, WorkOrderStatus.Dispatched, "Only planned work orders can be dispatched." }
        };

    public static TheoryData<WorkOrderStatus> ClosedStates =>
        new()
        {
            WorkOrderStatus.Completed,
            WorkOrderStatus.Cancelled
        };

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

    [Theory]
    [MemberData(nameof(ClosedStates))]
    public void Closed_order_cannot_be_changed(WorkOrderStatus targetState)
    {
        var order = NewOrderInState(targetState);

        Action act = () => order.Update("Bern", "Updated summary", WorkOrderPriority.Standard, Now.AddHours(2), "Lea Müller", Now.AddMinutes(20));

        act.Should().Throw<WorkOrderInvalidTransitionException>()
            .WithMessage("Completed or cancelled work orders cannot be changed.");
    }

    [Theory]
    [MemberData(nameof(ClosedStates))]
    public void Closed_order_cannot_be_cancelled(WorkOrderStatus targetState)
    {
        var order = NewOrderInState(targetState);

        Action act = () => order.Cancel("Duplicate request", Now.AddMinutes(20));

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
    public void Dispatch_requires_an_assignee()
    {
        var order = NewOrder();

        Action act = () => order.DispatchTo("   ", Now.AddMinutes(5));

        act.Should().Throw<WorkOrderValidationException>()
            .WithMessage("An assignee is required. (Parameter 'assignee')");
    }

    [Fact]
    public void Update_rejects_an_undefined_priority()
    {
        var order = NewOrder();

        Action act = () => order.Update("Bern", "Updated summary", (WorkOrderPriority)999, Now.AddHours(2), "Lea Müller", Now.AddMinutes(20));

        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithMessage("The work-order priority is not defined. (Parameter 'priority')*");
    }

    [Theory]
    [MemberData(nameof(InvalidTransitions))]
    public void Advance_to_rejected_state_changes_throw_transition_errors(
        WorkOrderStatus currentState,
        WorkOrderStatus targetState,
        string expectedMessage)
    {
        var order = NewOrderInState(currentState);

        Action act = () => order.AdvanceTo(targetState, null, Now.AddMinutes(30));

        act.Should().Throw<WorkOrderInvalidTransitionException>()
            .WithMessage(expectedMessage);
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

    private static WorkOrder NewOrderInState(WorkOrderStatus status)
    {
        var order = NewOrder();

        switch (status)
        {
            case WorkOrderStatus.Planned:
                return order;
            case WorkOrderStatus.Dispatched:
                order.DispatchTo("Lea Müller", Now.AddMinutes(5));
                return order;
            case WorkOrderStatus.InProgress:
                order.DispatchTo("Lea Müller", Now.AddMinutes(5));
                order.Start(Now.AddMinutes(10));
                return order;
            case WorkOrderStatus.Blocked:
                order.DispatchTo("Lea Müller", Now.AddMinutes(5));
                order.Start(Now.AddMinutes(10));
                order.Block(Now.AddMinutes(15));
                return order;
            case WorkOrderStatus.Completed:
                order.DispatchTo("Lea Müller", Now.AddMinutes(5));
                order.Start(Now.AddMinutes(10));
                order.Complete(Now.AddMinutes(15));
                return order;
            case WorkOrderStatus.Cancelled:
                order.Cancel("Duplicate request", Now.AddMinutes(5));
                return order;
            default:
                throw new ArgumentOutOfRangeException(nameof(status), status, null);
        }
    }
}

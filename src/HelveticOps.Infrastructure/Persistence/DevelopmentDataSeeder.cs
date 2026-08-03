using HelveticOps.Domain.WorkOrders;
using Microsoft.EntityFrameworkCore;

namespace HelveticOps.Infrastructure.Persistence;

public sealed class DevelopmentDataSeeder(OperationsDbContext dbContext)
{
    private static readonly DateTimeOffset SeedTimestamp = new(2026, 1, 15, 8, 0, 0, TimeSpan.Zero);

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        var seedDefinitions = new[]
        {
            new SeedDefinition("DEMO-WO-001", "Demo Site Alpha", "Inspect platform lift", WorkOrderPriority.Critical,
                SeedTimestamp.AddMinutes(30), SeedTimestamp.AddDays(-2), WorkOrderStatus.InProgress, "Demo Technician A"),
            new SeedDefinition("DEMO-WO-002", "Demo Site Beta", "Replace access sensor", WorkOrderPriority.Urgent,
                SeedTimestamp.AddHours(2), SeedTimestamp.AddDays(-1), WorkOrderStatus.Dispatched, "Demo Technician B"),
            new SeedDefinition("DEMO-WO-003", "Demo Site Gamma", "Inspect lighting circuit", WorkOrderPriority.Standard,
                SeedTimestamp.AddHours(6), SeedTimestamp.AddHours(-8), WorkOrderStatus.Planned, null),
            new SeedDefinition("DEMO-WO-004", "Demo Site Delta", "Investigate ventilation control", WorkOrderPriority.Urgent,
                SeedTimestamp.AddMinutes(45), SeedTimestamp.AddDays(-3), WorkOrderStatus.Blocked, "Demo Technician C")
        };

        var references = seedDefinitions.Select(definition => definition.Reference).ToArray();
        var existingReferenceValues = await dbContext.WorkOrders
            .Where(workOrder => references.Contains(workOrder.Reference))
            .Select(workOrder => workOrder.Reference)
            .ToListAsync(cancellationToken);
        var existingReferences = existingReferenceValues.ToHashSet(StringComparer.Ordinal);

        var missingOrders = seedDefinitions
            .Where(definition => !existingReferences.Contains(definition.Reference))
            .Select(CreateWorkOrder)
            .ToArray();

        if (missingOrders.Length == 0)
        {
            return;
        }

        await dbContext.WorkOrders.AddRangeAsync(missingOrders, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static WorkOrder CreateWorkOrder(SeedDefinition definition)
    {
        var workOrder = new WorkOrder(definition.Reference, definition.Site, definition.Summary,
            definition.Priority, definition.DueAt, definition.CreatedAt);

        if (definition.Status is WorkOrderStatus.Dispatched or WorkOrderStatus.InProgress or WorkOrderStatus.Blocked)
        {
            workOrder.DispatchTo(definition.Assignee!, SeedTimestamp.AddHours(-5));
        }

        if (definition.Status is WorkOrderStatus.InProgress or WorkOrderStatus.Blocked)
        {
            workOrder.Start(SeedTimestamp.AddHours(-4));
        }

        if (definition.Status is WorkOrderStatus.Blocked)
        {
            workOrder.Block(SeedTimestamp.AddHours(-1));
        }

        return workOrder;
    }

    private sealed record SeedDefinition(string Reference, string Site, string Summary, WorkOrderPriority Priority,
        DateTimeOffset DueAt, DateTimeOffset CreatedAt, WorkOrderStatus Status, string? Assignee);
}

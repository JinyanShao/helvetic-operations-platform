using HelveticOps.Application.WorkOrders;
using HelveticOps.Domain.WorkOrders;

namespace HelveticOps.Api.Endpoints;

public static class WorkOrderEndpoints
{
    public static IEndpointRouteBuilder MapWorkOrderEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/work-orders").WithTags("Work orders");

        group.MapGet("/", async (WorkOrderService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.ListAsync(cancellationToken)))
            .WithName("ListWorkOrders")
            .WithOpenApi();

        group.MapPost("/", async (CreateWorkOrderRequest request, WorkOrderService service, CancellationToken cancellationToken) =>
        {
            var created = await service.CreateAsync(
                request.Reference,
                request.Site,
                request.Summary,
                request.Priority,
                request.DueAt,
                cancellationToken);
            return Results.Created($"/api/work-orders/{created.Id}", created);
        })
        .WithName("CreateWorkOrder")
        .WithOpenApi();

        return endpoints;
    }
}

public sealed record CreateWorkOrderRequest(
    string Reference,
    string Site,
    string Summary,
    WorkOrderPriority Priority,
    DateTimeOffset DueAt);

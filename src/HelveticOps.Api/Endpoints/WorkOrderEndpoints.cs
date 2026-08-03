using System.Security.Claims;
using FluentValidation;
using HelveticOps.Api.Security;
using HelveticOps.Application.WorkOrders;
using HelveticOps.Domain.WorkOrders;
using Microsoft.AspNetCore.Mvc;
using Microsoft.OpenApi.Models;
using System.ComponentModel.DataAnnotations;

namespace HelveticOps.Api.Endpoints;

public static class WorkOrderEndpoints
{
    public static IEndpointRouteBuilder MapWorkOrderEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/work-orders").WithTags("Work orders");

        group.MapGet("/", ListAsync).RequireAuthorization(OperationsPolicies.Viewer)
            .WithName("ListWorkOrders").WithSummary("List and filter work orders")
            .WithDescription("Returns a safely sorted, server-paged work-order projection. Page size is limited to 100.")
            .Produces<PagedResult<WorkOrderListItem>>().ProducesValidationProblem()
            .WithOpenApi(operation => DescribeParameters(operation,
                ("page", "One-based page number."), ("pageSize", "Items per page, from 1 to 100."),
                ("status", "Optional work-order status filter."), ("priority", "Optional priority filter."),
                ("site", "Optional exact site filter."), ("slaRisk", "Optional SLA-risk filter."),
                ("sort", "Allowed sort field."), ("direction", "Ascending or descending sort direction.")));

        group.MapGet("/{id:guid}", GetAsync).RequireAuthorization(OperationsPolicies.Viewer)
            .WithName("GetWorkOrder").WithSummary("Get one work order")
            .Produces<WorkOrderDetail>().ProducesProblem(StatusCodes.Status404NotFound)
            .WithOpenApi(operation => DescribeParameters(operation, ("id", "Work-order identifier.")));

        group.MapPost("/", CreateAsync).RequireAuthorization(OperationsPolicies.Dispatcher)
            .WithName("CreateWorkOrder").WithSummary("Create a work order")
            .Produces<WorkOrderDetail>(StatusCodes.Status201Created).ProducesValidationProblem().WithOpenApi();

        group.MapPut("/{id:guid}", UpdateAsync).RequireAuthorization(OperationsPolicies.Dispatcher)
            .WithName("UpdateWorkOrder").WithSummary("Update editable work-order fields")
            .Produces<WorkOrderDetail>().ProducesValidationProblem().ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .WithOpenApi(operation => DescribeParameters(operation, ("id", "Work-order identifier.")));

        group.MapPost("/{id:guid}/transitions", TransitionAsync).RequireAuthorization(OperationsPolicies.Dispatcher)
            .WithName("TransitionWorkOrder").WithSummary("Advance the guarded work-order lifecycle")
            .Produces<WorkOrderDetail>().ProducesValidationProblem().ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .WithOpenApi(operation => DescribeParameters(operation, ("id", "Work-order identifier.")));

        group.MapPost("/{id:guid}/cancel", CancelAsync).RequireAuthorization(OperationsPolicies.Manager)
            .WithName("CancelWorkOrder").WithSummary("Cancel a work order")
            .Produces<WorkOrderDetail>().ProducesValidationProblem().ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .WithOpenApi(operation => DescribeParameters(operation, ("id", "Work-order identifier.")));

        return endpoints;
    }

    private static async Task<IResult> ListAsync([AsParameters] WorkOrderQueryRequest request,
        IValidator<WorkOrderQueryRequest> validator, WorkOrderService service, CancellationToken cancellationToken)
    {
        var invalid = await ValidateAsync(request, validator, cancellationToken);
        if (invalid is not null) return invalid;
        return Results.Ok(await service.ListAsync(new WorkOrderQuery(request.Page, request.PageSize, request.Status,
            request.Priority, request.Site, request.SlaRisk, request.Sort, request.Direction), cancellationToken));
    }

    private static async Task<IResult> GetAsync(Guid id, WorkOrderService service, CancellationToken cancellationToken) =>
        Results.Ok(await service.GetAsync(id, cancellationToken));

    private static async Task<IResult> CreateAsync(CreateWorkOrderRequest request,
        IValidator<CreateWorkOrderRequest> validator, WorkOrderService service, CancellationToken cancellationToken)
    {
        var invalid = await ValidateAsync(request, validator, cancellationToken);
        if (invalid is not null) return invalid;
        var created = await service.CreateAsync(request.Reference, request.Site, request.Summary, request.Priority,
            request.DueAt, cancellationToken);
        return Results.Created($"/api/work-orders/{created.Id}", created);
    }

    private static async Task<IResult> UpdateAsync(Guid id, UpdateWorkOrderRequest request,
        IValidator<UpdateWorkOrderRequest> validator, WorkOrderService service, CancellationToken cancellationToken)
    {
        var invalid = await ValidateAsync(request, validator, cancellationToken);
        if (invalid is not null) return invalid;
        return Results.Ok(await service.UpdateAsync(id, request.Site, request.Summary, request.Priority, request.DueAt,
            request.Assignee, request.Version, cancellationToken));
    }

    private static async Task<IResult> TransitionAsync(Guid id, TransitionWorkOrderRequest request,
        IValidator<TransitionWorkOrderRequest> validator, WorkOrderService service, ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var invalid = await ValidateAsync(request, validator, cancellationToken);
        if (invalid is not null) return invalid;
        return Results.Ok(await service.AdvanceAsync(id, request.TargetStatus, request.Assignee, request.Version,
            Actor(user), cancellationToken));
    }

    private static async Task<IResult> CancelAsync(Guid id, CancelWorkOrderRequest request,
        IValidator<CancelWorkOrderRequest> validator, WorkOrderService service, ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var invalid = await ValidateAsync(request, validator, cancellationToken);
        if (invalid is not null) return invalid;
        return Results.Ok(await service.CancelAsync(id, request.Reason, request.Version, Actor(user), cancellationToken));
    }

    private static async Task<IResult?> ValidateAsync<T>(T request, IValidator<T> validator, CancellationToken cancellationToken)
    {
        var result = await validator.ValidateAsync(request, cancellationToken);
        return result.IsValid ? null : Results.ValidationProblem(result.ToDictionary());
    }

    private static AuditActor Actor(ClaimsPrincipal user) => new(
        user.FindFirstValue("oid") ?? user.FindFirstValue(ClaimTypes.NameIdentifier),
        user.FindFirstValue("name") ?? user.Identity?.Name);

    private static OpenApiOperation DescribeParameters(OpenApiOperation operation,
        params (string Name, string Description)[] descriptions)
    {
        foreach (var (name, description) in descriptions)
        {
            var parameter = operation.Parameters.FirstOrDefault(candidate =>
                string.Equals(candidate.Name, name, StringComparison.OrdinalIgnoreCase));
            if (parameter is not null) parameter.Description = description;
        }

        return operation;
    }
}

public sealed record WorkOrderQueryRequest(int Page = 1, int PageSize = 20, WorkOrderStatus? Status = null,
    WorkOrderPriority? Priority = null, string? Site = null, bool? SlaRisk = null,
    WorkOrderSort Sort = WorkOrderSort.DueAt, SortDirection Direction = SortDirection.Ascending);
public sealed record CreateWorkOrderRequest([property: Required] string Reference, [property: Required] string Site,
    [property: Required] string Summary, [property: Required] WorkOrderPriority Priority, [property: Required] DateTimeOffset DueAt);
public sealed record UpdateWorkOrderRequest([property: Required] string Site, [property: Required] string Summary,
    [property: Required] WorkOrderPriority Priority, [property: Required] DateTimeOffset DueAt, string? Assignee,
    [property: Required] string Version);
public sealed record TransitionWorkOrderRequest([property: Required] WorkOrderStatus TargetStatus, string? Assignee,
    [property: Required] string Version);
public sealed record CancelWorkOrderRequest([property: Required] string Reason, [property: Required] string Version);

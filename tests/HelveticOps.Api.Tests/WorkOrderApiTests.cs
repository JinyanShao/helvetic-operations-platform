using System.Net;
using System.Net.Http.Json;
using HelveticOps.Api.Endpoints;
using HelveticOps.Application.WorkOrders;
using HelveticOps.Domain.WorkOrders;
using HelveticOps.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HelveticOps.Api.Tests;

[Collection(SqlServerCollection.Name)]
public sealed class WorkOrderApiTests(SqlServerFixture database) : IAsyncLifetime
{
    private OperationsApiFactory factory = null!;
    private HttpClient client = null!;

    public async Task InitializeAsync()
    {
        await database.ResetAsync();
        factory = new OperationsApiFactory(database);
        client = factory.CreateClient();
    }

    public async Task DisposeAsync()
    {
        client.Dispose();
        await factory.DisposeAsync();
    }

    [Fact]
    public async Task Invalid_create_returns_validation_problem_details()
    {
        var response = await client.PostAsJsonAsync("/api/work-orders", new CreateWorkOrderRequest("", "", "", WorkOrderPriority.Standard, default));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Viewer_cannot_create_work_order()
    {
        client.DefaultRequestHeaders.Add("X-Test-Role", "Operations.Viewer");
        var response = await client.PostAsJsonAsync("/api/work-orders", ValidCreate("WO-VIEW"));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Missing_detail_returns_not_found_problem_details()
    {
        client.DefaultRequestHeaders.Add("X-Test-Role", "Operations.Viewer");
        var response = await client.GetAsync($"/api/work-orders/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Viewer_can_list_with_pagination_filters_and_sorting()
    {
        await client.PostAsJsonAsync("/api/work-orders", ValidCreate("WO-LIST"));
        client.DefaultRequestHeaders.Remove("X-Test-Role");
        client.DefaultRequestHeaders.Add("X-Test-Role", "Operations.Viewer");

        var response = await client.GetAsync("/api/work-orders?page=1&pageSize=1&priority=Critical&site=Z%C3%BCrich%20HB&sort=Reference&direction=Ascending");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<PagedResult<WorkOrderListItem>>();
        Assert.Single(result!.Items);
        Assert.Equal("WO-LIST", result.Items[0].Reference);
    }

    [Fact]
    public async Task Create_read_update_and_stale_update_returns_conflict_without_audit()
    {
        var createdResponse = await client.PostAsJsonAsync("/api/work-orders", ValidCreate("WO-API"));
        Assert.Equal(HttpStatusCode.Created, createdResponse.StatusCode);
        var created = await createdResponse.Content.ReadFromJsonAsync<WorkOrderDetail>();
        Assert.NotNull(created);
        var firstVersion = created.Version;

        var read = await client.GetFromJsonAsync<WorkOrderDetail>($"/api/work-orders/{created.Id}");
        Assert.Equal(firstVersion, read!.Version);
        var update = new UpdateWorkOrderRequest("Basel SBB", "Updated sensor", WorkOrderPriority.Urgent,
            DateTimeOffset.UtcNow.AddDays(1), "Lea Müller", firstVersion);
        var firstUpdate = await client.PutAsJsonAsync($"/api/work-orders/{created.Id}", update);
        Assert.Equal(HttpStatusCode.OK, firstUpdate.StatusCode);
        var staleUpdate = await client.PutAsJsonAsync($"/api/work-orders/{created.Id}", update with { Summary = "Stale overwrite" });
        Assert.Equal(HttpStatusCode.Conflict, staleUpdate.StatusCode);
        await using var verify = database.CreateContext();
        Assert.Equal("Updated sensor", (await verify.WorkOrders.SingleAsync(x => x.Id == created.Id)).Summary);
        Assert.Equal(0, await verify.WorkOrderAuditEvents.CountAsync(x => x.WorkOrderId == created.Id));
    }

    [Fact]
    public async Task Dispatcher_transitions_and_manager_cancels_with_audit_events()
    {
        var created = await (await client.PostAsJsonAsync("/api/work-orders", ValidCreate("WO-AUDIT")))
            .Content.ReadFromJsonAsync<WorkOrderDetail>();
        var transitioned = await (await client.PostAsJsonAsync($"/api/work-orders/{created!.Id}/transitions",
            new TransitionWorkOrderRequest(WorkOrderStatus.Dispatched, "Noah Frei", created.Version)))
            .Content.ReadFromJsonAsync<WorkOrderDetail>();
        var staleTransition = await client.PostAsJsonAsync($"/api/work-orders/{created.Id}/transitions",
            new TransitionWorkOrderRequest(WorkOrderStatus.InProgress, null, created.Version));
        Assert.Equal(HttpStatusCode.Conflict, staleTransition.StatusCode);
        var cancelled = await client.PostAsJsonAsync($"/api/work-orders/{created.Id}/cancel",
            new CancelWorkOrderRequest("Site access withdrawn", transitioned!.Version));
        Assert.Equal(HttpStatusCode.OK, cancelled.StatusCode);
        await using var verify = database.CreateContext();
        Assert.Equal(2, await verify.WorkOrderAuditEvents.CountAsync(x => x.WorkOrderId == created.Id));
    }

    [Fact]
    public async Task Invalid_legal_sequence_returns_business_conflict()
    {
        var created = await (await client.PostAsJsonAsync("/api/work-orders", ValidCreate("WO-CONFLICT")))
            .Content.ReadFromJsonAsync<WorkOrderDetail>();
        var response = await client.PostAsJsonAsync($"/api/work-orders/{created!.Id}/transitions",
            new TransitionWorkOrderRequest(WorkOrderStatus.Completed, null, created.Version));
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal("The requested lifecycle change is not allowed.", problem!.Detail);
    }

    [Fact]
    public async Task Dispatcher_cannot_cancel()
    {
        client.DefaultRequestHeaders.Add("X-Test-Role", "Operations.Dispatcher");
        var response = await client.PostAsJsonAsync($"/api/work-orders/{Guid.NewGuid()}/cancel",
            new CancelWorkOrderRequest("Not authorised", Convert.ToBase64String(new byte[8])));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private static CreateWorkOrderRequest ValidCreate(string reference) =>
        new(reference, "Zürich HB", "Inspect platform lift", WorkOrderPriority.Critical, DateTimeOffset.UtcNow.AddDays(1));
}

using System.Security.Claims;
using HelveticOps.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace HelveticOps.Api.Tests;

public sealed class OperationsAuthorizationTests
{
    private readonly IAuthorizationService authorization;

    public OperationsAuthorizationTests()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddOperationsAuthorization();
        authorization = services.BuildServiceProvider().GetRequiredService<IAuthorizationService>();
    }

    [Theory]
    [InlineData(OperationsRoles.Viewer)]
    [InlineData(OperationsRoles.Dispatcher)]
    [InlineData(OperationsRoles.Manager)]
    public async Task Viewer_policy_accepts_each_role_in_the_hierarchy(string role)
    {
        var result = await authorization.AuthorizeAsync(User(role, OperationsAuthorization.AccessAsUserScope), null, OperationsPolicies.Viewer);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public async Task Dispatcher_policy_rejects_viewer()
    {
        var result = await authorization.AuthorizeAsync(User(OperationsRoles.Viewer, OperationsAuthorization.AccessAsUserScope), null, OperationsPolicies.Dispatcher);

        Assert.False(result.Succeeded);
    }

    [Fact]
    public async Task Dispatcher_policy_accepts_manager()
    {
        var result = await authorization.AuthorizeAsync(User(OperationsRoles.Manager, OperationsAuthorization.AccessAsUserScope), null, OperationsPolicies.Dispatcher);

        Assert.True(result.Succeeded);
    }

    [Theory]
    [InlineData(OperationsPolicies.Dispatcher, OperationsRoles.Dispatcher, true)]
    [InlineData(OperationsPolicies.Dispatcher, OperationsRoles.Viewer, false)]
    [InlineData(OperationsPolicies.Manager, OperationsRoles.Manager, true)]
    [InlineData(OperationsPolicies.Manager, OperationsRoles.Dispatcher, false)]
    [InlineData(OperationsPolicies.Manager, OperationsRoles.Viewer, false)]
    public async Task Mutation_policy_matrix_is_enforced(string policy, string role, bool expected)
    {
        var result = await authorization.AuthorizeAsync(
            User(role, OperationsAuthorization.AccessAsUserScope), null, policy);
        Assert.Equal(expected, result.Succeeded);
    }

    [Fact]
    public async Task Policy_rejects_role_without_delegated_scope()
    {
        var result = await authorization.AuthorizeAsync(User(OperationsRoles.Manager), null, OperationsPolicies.Manager);

        Assert.False(result.Succeeded);
    }

    [Fact]
    public async Task Policy_rejects_scope_without_role()
    {
        var result = await authorization.AuthorizeAsync(User(scope: OperationsAuthorization.AccessAsUserScope), null, OperationsPolicies.Viewer);

        Assert.False(result.Succeeded);
    }

    private static ClaimsPrincipal User(string? role = null, string? scope = null)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, "test-user") };
        if (role is not null) claims.Add(new Claim(ClaimTypes.Role, role));
        if (scope is not null) claims.Add(new Claim("scp", $"openid {scope} profile"));
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
    }
}

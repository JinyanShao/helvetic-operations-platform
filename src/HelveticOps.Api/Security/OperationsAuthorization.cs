using System.Security.Claims;

namespace HelveticOps.Api.Security;

public static class OperationsRoles
{
    public const string Viewer = "Operations.Viewer";
    public const string Dispatcher = "Operations.Dispatcher";
    public const string Manager = "Operations.Manager";
}

public static class OperationsPolicies
{
    public const string Viewer = "Operations.Viewer";
    public const string Dispatcher = "Operations.Dispatcher";
    public const string Manager = "Operations.Manager";
}

public static class OperationsAuthorization
{
    public const string AccessAsUserScope = "access_as_user";

    public static IServiceCollection AddOperationsAuthorization(this IServiceCollection services)
    {
        services.AddAuthorization(options =>
        {
            options.AddPolicy(OperationsPolicies.Viewer, policy =>
                ConfigureDelegatedRolePolicy(policy, OperationsRoles.Viewer, OperationsRoles.Dispatcher, OperationsRoles.Manager));
            options.AddPolicy(OperationsPolicies.Dispatcher, policy =>
                ConfigureDelegatedRolePolicy(policy, OperationsRoles.Dispatcher, OperationsRoles.Manager));
            options.AddPolicy(OperationsPolicies.Manager, policy =>
                ConfigureDelegatedRolePolicy(policy, OperationsRoles.Manager));
        });

        return services;
    }

    private static void ConfigureDelegatedRolePolicy(
        Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder policy,
        params string[] acceptedRoles)
    {
        policy.RequireAuthenticatedUser();
        policy.RequireAssertion(context => HasDelegatedScope(context.User, AccessAsUserScope));
        policy.RequireRole(acceptedRoles);
    }

    internal static bool HasDelegatedScope(ClaimsPrincipal user, string requiredScope) =>
        user.FindAll("scp")
            .SelectMany(claim => claim.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries))
            .Contains(requiredScope, StringComparer.Ordinal);
}

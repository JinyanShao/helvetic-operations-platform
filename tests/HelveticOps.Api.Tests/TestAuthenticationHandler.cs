using System.Security.Claims;
using System.Text.Encodings.Web;
using HelveticOps.Api.Security;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;

namespace HelveticOps.Api.Tests;

public sealed class TestAuthenticationHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger,
    UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "IntegrationTest";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var role = Request.Headers["X-Test-Role"].FirstOrDefault() ?? OperationsRoles.Manager;
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "integration-user"), new Claim("oid", "integration-user"),
            new Claim("name", "Integration Operator"), new Claim("scp", OperationsAuthorization.AccessAsUserScope),
            new Claim(ClaimTypes.Role, role)
        };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName));
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName)));
    }
}

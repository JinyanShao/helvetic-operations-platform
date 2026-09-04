using System.Text.Json.Serialization;
using HelveticOps.Api.Endpoints;
using HelveticOps.Api.Security;
using HelveticOps.Application.WorkOrders;
using HelveticOps.Infrastructure;
using HelveticOps.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Identity.Web;
using FluentValidation;
using HelveticOps.Api.Errors;
using Azure.Monitor.OpenTelemetry.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddInfrastructure(builder.Configuration);
if (!string.IsNullOrWhiteSpace(builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"]))
    builder.Services.AddOpenTelemetry().UseAzureMonitor();
builder.Services.AddScoped<WorkOrderService>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddValidatorsFromAssemblyContaining<Program>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApi(
        jwtOptions =>
        {
            builder.Configuration.Bind("AzureAd", jwtOptions);
            jwtOptions.MapInboundClaims = false;
            jwtOptions.TokenValidationParameters.RoleClaimType = "roles";
            if (builder.Environment.IsDevelopment())
            {
                jwtOptions.Events = new JwtBearerEvents
                {
                    OnTokenValidated = context =>
                    {
                        var logger = context.HttpContext.RequestServices
                            .GetRequiredService<ILoggerFactory>()
                            .CreateLogger("HelveticOps.Api.Authentication");
                        var roles = string.Join(", ", context.Principal?.FindAll("roles").Select(claim => claim.Value) ?? []);
                        var scopes = string.Join(", ", context.Principal?.FindAll("scp").Select(claim => claim.Value) ?? []);
                        var claims = string.Join("; ",
                            context.Principal?.Claims.Select(claim => $"{claim.Type}={claim.Value}") ?? []);
                        logger.LogInformation(
                            "Validated token for {Path}. roles=[{Roles}] scp=[{Scopes}] roleClaimType={RoleClaimType} claims=[{Claims}]",
                            context.HttpContext.Request.Path,
                            roles,
                            scopes,
                            context.Options.TokenValidationParameters.RoleClaimType,
                            claims);
                        return Task.CompletedTask;
                    },
                    OnForbidden = context =>
                    {
                        var logger = context.HttpContext.RequestServices
                            .GetRequiredService<ILoggerFactory>()
                            .CreateLogger("HelveticOps.Api.Authentication");
                        var roles = string.Join(", ", context.HttpContext.User.FindAll("roles").Select(claim => claim.Value));
                        var scopes = string.Join(", ", context.HttpContext.User.FindAll("scp").Select(claim => claim.Value));
                        logger.LogWarning(
                            "Forbidden request for {Path}. roles=[{Roles}] scp=[{Scopes}] roleClaimType={RoleClaimType}",
                            context.HttpContext.Request.Path,
                            roles,
                            scopes,
                            context.Options.TokenValidationParameters.RoleClaimType);
                        return Task.CompletedTask;
                    }
                };
            }
        },
        identityOptions => builder.Configuration.Bind("AzureAd", identityOptions));
builder.Services.AddOperationsAuthorization();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHealthChecks().AddDbContextCheck<OperationsDbContext>();
builder.Services.AddCors(options => options.AddPolicy("web", policy =>
    policy.WithOrigins(builder.Configuration["WebOrigin"] ?? "http://localhost:4200")
        .AllowAnyHeader()
        .AllowAnyMethod()));

var app = builder.Build();

app.UseExceptionHandler();
app.UseHttpsRedirection();
app.UseCors("web");
app.UseAuthentication();
app.UseAuthorization();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapHealthChecks("/health").AllowAnonymous();
app.MapWorkOrderEndpoints();
app.Run();

public partial class Program;

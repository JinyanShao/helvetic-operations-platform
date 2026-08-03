using HelveticOps.Infrastructure;
using HelveticOps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddInfrastructure(builder.Configuration);
using var host = builder.Build();
await using var scope = host.Services.CreateAsyncScope();
var dbContext = scope.ServiceProvider.GetRequiredService<OperationsDbContext>();
await dbContext.Database.MigrateAsync();
if (builder.Configuration.GetValue("SeedData", false))
    await scope.ServiceProvider.GetRequiredService<DevelopmentDataSeeder>().SeedAsync();

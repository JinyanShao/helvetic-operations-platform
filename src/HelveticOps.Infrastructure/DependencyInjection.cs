using HelveticOps.Application.WorkOrders;
using HelveticOps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HelveticOps.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<OperationsDbContext>(options =>
            options.UseSqlServer(configuration.GetConnectionString("OperationsDb")));
        services.AddScoped<IWorkOrderRepository, WorkOrderRepository>();
        services.AddScoped<DevelopmentDataSeeder>();
        return services;
    }
}

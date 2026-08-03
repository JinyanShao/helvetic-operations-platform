using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace HelveticOps.Infrastructure.Persistence;

public sealed class OperationsDbContextFactory : IDesignTimeDbContextFactory<OperationsDbContext>
{
    private const string ConnectionEnvironmentVariable = "ConnectionStrings__OperationsDb";

    public OperationsDbContext CreateDbContext(string[] args)
    {
        var connection = GetCommandLineConnection(args)
            ?? Environment.GetEnvironmentVariable(ConnectionEnvironmentVariable);

        if (string.IsNullOrWhiteSpace(connection))
        {
            throw new InvalidOperationException(
                $"A design-time SQL Server connection string is required. Pass '--connection <connection-string>' " +
                $"to dotnet ef or set the {ConnectionEnvironmentVariable} environment variable.");
        }

        var options = new DbContextOptionsBuilder<OperationsDbContext>().UseSqlServer(connection).Options;
        return new OperationsDbContext(options);
    }

    private static string? GetCommandLineConnection(string[] args)
    {
        if (args.Length == 0)
        {
            return null;
        }

        if (args.Length != 2 || !string.Equals(args[0], "--connection", StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                "Unsupported design-time arguments. Use exactly '--connection <connection-string>'.");
        }

        if (string.IsNullOrWhiteSpace(args[1]))
        {
            throw new InvalidOperationException("The --connection argument requires a non-empty connection string.");
        }

        return args[1];
    }
}

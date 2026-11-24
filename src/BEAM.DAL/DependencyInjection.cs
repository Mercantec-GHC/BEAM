using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace BEAM.DAL;

public static class DependencyInjection
{
    public static IServiceCollection AddBeamDataAccess(this IServiceCollection services, string connectionString)
    {
        // Blazor circuits are long lived. Create and dispose one context per operation.
        services.AddDbContextFactory<BeamDbContext>(options =>
            options.UseNpgsql(connectionString, postgres => postgres.EnableRetryOnFailure()));
        services.AddScoped<GameRepository>();
        return services;
    }
}


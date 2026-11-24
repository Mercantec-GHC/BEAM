using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace BEAM.DAL;

public sealed class BeamDesignTimeDbContextFactory : IDesignTimeDbContextFactory<BeamDbContext>
{
    public BeamDbContext CreateDbContext(string[] args)
    {
        // Creating migrations doesn't connect. Updating a database requires an explicit connection.
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__beamdb")
            ?? "Host=localhost;Database=beam;Username=beam";
        return new BeamDbContext(new DbContextOptionsBuilder<BeamDbContext>()
            .UseNpgsql(connection).Options);
    }
}

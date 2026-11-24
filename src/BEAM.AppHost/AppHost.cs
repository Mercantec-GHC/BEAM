var builder = DistributedApplication.CreateBuilder(args);

var database = builder.AddPostgres("postgres")
    .WithImageTag("18")
    .WithDataVolume("beam-aspire-postgres")
    .AddDatabase("beamdb", "beam");

builder.AddDotnetProject("web", "../BEAM.Web/BEAM.Web.csproj")
    .WithReference(database)
    .WaitFor(database)
    .WithEnvironment("Database__ApplyMigrations", "true")
    .WithExternalHttpEndpoints()
    .WithHttpHealthCheck("/health");

builder.Build().Run();

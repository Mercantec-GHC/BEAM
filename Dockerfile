FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY global.json ./
# Include Razor sources before restore so the SDK discovers Blazor static assets.
COPY src/BEAM.Web/ src/BEAM.Web/
COPY src/BEAM.ServiceDefaults/ src/BEAM.ServiceDefaults/
COPY src/BEAM.DAL/ src/BEAM.DAL/
RUN dotnet restore src/BEAM.Web/BEAM.Web.csproj
RUN dotnet publish src/BEAM.Web/BEAM.Web.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
COPY --from=build /app/publish .
USER $APP_UID
ENTRYPOINT ["dotnet", "BEAM.Web.dll"]

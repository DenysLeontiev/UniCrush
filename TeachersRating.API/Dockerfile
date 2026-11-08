FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 5166

ENV ASPNETCORE_URLS=http://+:5166

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG configuration=Release
WORKDIR /src
COPY ["TeachersRating.API/TeachersRating.API.csproj", "TeachersRating.API/"]
RUN dotnet restore "TeachersRating.API/TeachersRating.API.csproj"
COPY . .
WORKDIR "/src/TeachersRating.API"
RUN dotnet build "TeachersRating.API.csproj" -c $configuration -o /app/build

FROM build AS publish
ARG configuration=Release
RUN dotnet publish "TeachersRating.API.csproj" -c $configuration -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
# Bundled teacher list (fallback when no fresh scrape exists in /app/scraper-data)
COPY ["NulpScrapper/output.json", "../NulpScrapper/output.json"]
ENTRYPOINT ["dotnet", "TeachersRating.API.dll"]

targetScope = 'resourceGroup'

@description('Short environment name, for example dev or prod.')
param environmentName string = 'dev'
param location string = resourceGroup().location
@secure()
param sqlAdministratorPassword string

var suffix = uniqueString(resourceGroup().id)
var appName = 'helvetic-ops-${environmentName}-${suffix}'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${appName}-logs'
  location: location
  properties: { retentionInDays: 30 }
}

resource appEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${appName}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: '${appName}-sql'
  location: location
  properties: {
    administratorLogin: 'helveticadmin'
    administratorLoginPassword: sqlAdministratorPassword
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Disabled'
  }
}

resource database 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: 'operations'
  location: location
  sku: { name: 'Basic', tier: 'Basic' }
  properties: { zoneRedundant: false }
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: replace(appName, '-', '')
  location: location
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

output containerRegistry string = registry.properties.loginServer
output sqlServerName string = sqlServer.name
output containerEnvironmentName string = appEnvironment.name

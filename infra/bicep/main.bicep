targetScope = 'resourceGroup'

@allowed([
  'e2e'
  'nonprod'
  'prod'
])
@description('Deployment environment. Use e2e or nonprod before production cutover.')
param environmentName string

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Container image tag. Use an immutable commit SHA, not latest.')
param imageTag string

@description('Set false for the first bootstrap pass that creates ACR before images exist.')
param deployWorkloads bool = true

@description('Microsoft Entra tenant ID used by API token validation and SPA login.')
param entraTenantId string

@description('Microsoft Entra SPA app client ID.')
param entraSpaClientId string

@description('Microsoft Entra API app client ID / audience.')
param entraApiClientId string

@secure()
@description('SQL administrator password. Stored in Key Vault only; never output.')
param sqlAdministratorPassword string

@description('SQL administrator login used by the migration job and API connection string.')
param sqlAdministratorLogin string = 'helveticadmin'

@description('Optional email receivers for Azure Monitor action group notifications.')
param alertEmailReceivers array = []

var suffix = uniqueString(subscription().id, resourceGroup().id, environmentName)
var namePrefix = 'ho${environmentName}-${suffix}'
var tags = {
  application: 'helvetic-operations-platform'
  environment: environmentName
  managedBy: 'bicep'
}
var registryName = 'hop${environmentName}${suffix}'
var databaseName = 'operations'
var apiAppName = '${namePrefix}-api'
var webAppName = '${namePrefix}-web'
var migratorJobName = '${namePrefix}-migrator'
var apiImage = '${registry.properties.loginServer}/helvetic-ops-api:${imageTag}'
var webImage = '${registry.properties.loginServer}/helvetic-ops-web:${imageTag}'
var migratorImage = '${registry.properties.loginServer}/helvetic-ops-migrator:${imageTag}'
var webUrl = 'https://${webAppName}.${appEnvironment.properties.defaultDomain}'
var apiInternalUrl = 'http://${apiAppName}'
var sqlPrivateDnsZoneName = 'privatelink${environment().suffixes.sqlServerHostname}'
var operationsConnectionString = 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Initial Catalog=${databaseName};Persist Security Info=False;User ID=${sqlAdministratorLogin};Password=${sqlAdministratorPassword};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-logs'
  location: location
  tags: tags
  properties: {
    retentionInDays: environmentName == 'prod' ? 90 : 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${namePrefix}-appi'
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: '${namePrefix}-vnet'
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.42.0.0/16'
      ]
    }
    subnets: [
      {
        name: 'container-apps'
        properties: {
          addressPrefix: '10.42.0.0/23'
          delegations: [
            {
              name: 'container-apps-delegation'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
      }
      {
        name: 'private-endpoints'
        properties: {
          addressPrefix: '10.42.2.0/27'
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

resource acaSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' existing = {
  parent: vnet
  name: 'container-apps'
}

resource privateEndpointSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' existing = {
  parent: vnet
  name: 'private-endpoints'
}

resource appEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${namePrefix}-env'
  location: location
  tags: tags
  properties: {
    vnetConfiguration: {
      infrastructureSubnetId: acaSubnet.id
    }
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
  }
}

resource workloadIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-workload-mi'
  location: location
  tags: tags
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: take('${namePrefix}-kv', 24)
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enablePurgeProtection: environmentName == 'prod'
    softDeleteRetentionInDays: environmentName == 'prod' ? 90 : 7
    publicNetworkAccess: 'Enabled'
  }
}

resource operationsDbSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'operations-db-connection-string'
  properties: {
    value: operationsConnectionString
  }
}

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: '${namePrefix}-sql'
  location: location
  tags: tags
  properties: {
    administratorLogin: sqlAdministratorLogin
    administratorLoginPassword: sqlAdministratorPassword
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Disabled'
  }
}

resource database 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: databaseName
  location: location
  tags: tags
  sku: {
    name: environmentName == 'prod' ? 'S0' : 'Basic'
    tier: environmentName == 'prod' ? 'Standard' : 'Basic'
  }
  properties: {
    zoneRedundant: false
  }
}

resource sqlPrivateDns 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: sqlPrivateDnsZoneName
  location: 'global'
  tags: tags
}

resource sqlPrivateDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: sqlPrivateDns
  name: '${namePrefix}-sql-link'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}

resource sqlPrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: '${namePrefix}-sql-pe'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointSubnet.id
    }
    privateLinkServiceConnections: [
      {
        name: '${namePrefix}-sql-pls'
        properties: {
          privateLinkServiceId: sqlServer.id
          groupIds: [
            'sqlServer'
          ]
        }
      }
    ]
  }
}

resource sqlPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: sqlPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'sql'
        properties: {
          privateDnsZoneId: sqlPrivateDns.id
        }
      }
    ]
  }
  dependsOn: [
    sqlPrivateDnsLink
  ]
}

resource acrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, workloadIdentity.id, 'AcrPull')
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: workloadIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource keyVaultSecretsAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, workloadIdentity.id, 'KeyVaultSecretsUser')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6c')
    principalId: workloadIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: '${namePrefix}-ops-ag'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: take(replace(environmentName, '-', ''), 12)
    enabled: length(alertEmailReceivers) > 0
    emailReceivers: [for receiver in alertEmailReceivers: {
      name: receiver.name
      emailAddress: receiver.email
      useCommonAlertSchema: true
    }]
  }
}

resource apiApp 'Microsoft.App/containerApps@2024-03-01' = if (deployWorkloads) {
  name: apiAppName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${workloadIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: appEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: registry.properties.loginServer
          identity: workloadIdentity.id
        }
      ]
      secrets: [
        {
          name: 'operations-db'
          keyVaultUrl: operationsDbSecret.properties.secretUri
          identity: workloadIdentity.id
        }
      ]
      ingress: {
        external: false
        targetPort: 8080
        transport: 'http'
        allowInsecure: false
      }
    }
    template: {
      containers: [
        {
          name: 'api'
          image: apiImage
          env: [
            {
              name: 'ASPNETCORE_URLS'
              value: 'http://+:8080'
            }
            {
              name: 'ASPNETCORE_ENVIRONMENT'
              value: environmentName == 'prod' ? 'Production' : 'Staging'
            }
            {
              name: 'ConnectionStrings__OperationsDb'
              secretRef: 'operations-db'
            }
            {
              name: 'WebOrigin'
              value: webUrl
            }
            {
              name: 'AzureAd__TenantId'
              value: entraTenantId
            }
            {
              name: 'AzureAd__ClientId'
              value: entraApiClientId
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: appInsights.properties.ConnectionString
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 8080
              }
              initialDelaySeconds: 20
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 8080
              }
              initialDelaySeconds: 10
              periodSeconds: 15
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: environmentName == 'prod' ? 1 : 0
        maxReplicas: environmentName == 'prod' ? 5 : 2
        rules: [
          {
            name: 'http'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
  dependsOn: [
    acrPullAssignment
    keyVaultSecretsAssignment
    sqlPrivateDnsZoneGroup
  ]
}

resource webApp 'Microsoft.App/containerApps@2024-03-01' = if (deployWorkloads) {
  name: webAppName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${workloadIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: appEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: registry.properties.loginServer
          identity: workloadIdentity.id
        }
      ]
      ingress: {
        external: true
        targetPort: 80
        transport: 'http'
        allowInsecure: false
      }
    }
    template: {
      containers: [
        {
          name: 'web'
          image: webImage
          env: [
            {
              name: 'API_UPSTREAM'
              value: apiInternalUrl
            }
            {
              name: 'ENTRA_TENANT_ID'
              value: entraTenantId
            }
            {
              name: 'ENTRA_SPA_CLIENT_ID'
              value: entraSpaClientId
            }
            {
              name: 'ENTRA_API_CLIENT_ID'
              value: entraApiClientId
            }
            {
              name: 'ENTRA_API_BASE_URL'
              value: webUrl
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/'
                port: 80
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/'
                port: 80
              }
              initialDelaySeconds: 5
              periodSeconds: 15
            }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: environmentName == 'prod' ? 1 : 0
        maxReplicas: environmentName == 'prod' ? 5 : 2
        rules: [
          {
            name: 'http'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
  dependsOn: [
    apiApp
    acrPullAssignment
  ]
}

resource migratorJob 'Microsoft.App/jobs@2024-03-01' = if (deployWorkloads) {
  name: migratorJobName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${workloadIdentity.id}': {}
    }
  }
  properties: {
    environmentId: appEnvironment.id
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 1800
      replicaRetryLimit: 0
      registries: [
        {
          server: registry.properties.loginServer
          identity: workloadIdentity.id
        }
      ]
      secrets: [
        {
          name: 'operations-db'
          keyVaultUrl: operationsDbSecret.properties.secretUri
          identity: workloadIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'migrator'
          image: migratorImage
          env: [
            {
              name: 'ConnectionStrings__OperationsDb'
              secretRef: 'operations-db'
            }
            {
              name: 'SeedData'
              value: 'false'
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
    }
  }
  dependsOn: [
    acrPullAssignment
    keyVaultSecretsAssignment
    sqlPrivateDnsZoneGroup
  ]
}

resource apiAvailabilityAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = if (deployWorkloads) {
  name: '${apiAppName}-availability'
  location: 'global'
  tags: tags
  properties: {
    description: 'API requests are failing in ${environmentName}.'
    severity: environmentName == 'prod' ? 2 : 3
    enabled: length(alertEmailReceivers) > 0
    scopes: [
      apiApp.id
    ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'ServerErrors'
          metricNamespace: 'Microsoft.App/containerApps'
          metricName: 'Requests'
          operator: 'GreaterThan'
          threshold: 0
          timeAggregation: 'Total'
          criterionType: 'StaticThresholdCriterion'
          dimensions: [
            {
              name: 'StatusCodeCategory'
              operator: 'Include'
              values: [
                '5xx'
              ]
            }
          ]
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

resource webAvailabilityAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = if (deployWorkloads) {
  name: '${webAppName}-availability'
  location: 'global'
  tags: tags
  properties: {
    description: 'Web requests are failing in ${environmentName}.'
    severity: environmentName == 'prod' ? 2 : 3
    enabled: length(alertEmailReceivers) > 0
    scopes: [
      webApp.id
    ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'ServerErrors'
          metricNamespace: 'Microsoft.App/containerApps'
          metricName: 'Requests'
          operator: 'GreaterThan'
          threshold: 0
          timeAggregation: 'Total'
          criterionType: 'StaticThresholdCriterion'
          dimensions: [
            {
              name: 'StatusCodeCategory'
              operator: 'Include'
              values: [
                '5xx'
              ]
            }
          ]
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

output environment string = environmentName
output containerRegistryLoginServer string = registry.properties.loginServer
output containerRegistryName string = registry.name
output containerAppsEnvironmentName string = appEnvironment.name
output apiContainerAppName string = apiAppName
output webContainerAppName string = webAppName
output migratorJobName string = migratorJobName
output webUrl string = webUrl
output sqlServerName string = sqlServer.name
output databaseName string = database.name
output keyVaultName string = keyVault.name

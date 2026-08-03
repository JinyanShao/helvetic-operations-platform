using System.Text.Json.Serialization;

namespace HelveticOps.Domain.WorkOrders;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum WorkOrderPriority
{
    Standard,
    Urgent,
    Critical
}

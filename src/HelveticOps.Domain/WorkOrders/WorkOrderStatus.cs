using System.Text.Json.Serialization;

namespace HelveticOps.Domain.WorkOrders;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum WorkOrderStatus
{
    Planned,
    Dispatched,
    InProgress,
    Blocked,
    Completed,
    Cancelled
}

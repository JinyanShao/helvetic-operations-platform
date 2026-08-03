using HelveticOps.Domain.WorkOrders;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HelveticOps.Infrastructure.Persistence.Configurations;

public sealed class WorkOrderAuditEventConfiguration : IEntityTypeConfiguration<WorkOrderAuditEvent>
{
    public void Configure(EntityTypeBuilder<WorkOrderAuditEvent> builder)
    {
        builder.ToTable("WorkOrderAuditEvents");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.WorkOrderId).IsRequired();
        builder.Property(x => x.EventType).HasConversion<string>().HasMaxLength(40).IsRequired();
        builder.Property(x => x.FromStatus).HasConversion<string>().HasMaxLength(24);
        builder.Property(x => x.ToStatus).HasConversion<string>().HasMaxLength(24);
        builder.Property(x => x.ActorObjectId).HasMaxLength(WorkOrderAuditEvent.ActorObjectIdMaxLength);
        builder.Property(x => x.ActorDisplayName).HasMaxLength(WorkOrderAuditEvent.ActorDisplayNameMaxLength);
        builder.Property(x => x.Reason).HasMaxLength(WorkOrderAuditEvent.ReasonMaxLength);
        builder.Property(x => x.OccurredAt).HasColumnType("datetimeoffset").IsRequired();
        builder.HasIndex(x => new { x.WorkOrderId, x.OccurredAt });
        builder.HasOne<WorkOrder>().WithMany().HasForeignKey(x => x.WorkOrderId).OnDelete(DeleteBehavior.Restrict);
    }
}

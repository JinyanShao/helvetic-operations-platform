using HelveticOps.Domain.WorkOrders;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HelveticOps.Infrastructure.Persistence.Configurations;

public sealed class WorkOrderConfiguration : IEntityTypeConfiguration<WorkOrder>
{
    public void Configure(EntityTypeBuilder<WorkOrder> builder)
    {
        builder.ToTable("WorkOrders");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Reference).HasMaxLength(24).IsRequired();
        builder.HasIndex(x => x.Reference).IsUnique();
        builder.Property(x => x.Site).HasMaxLength(120).IsRequired();
        builder.Property(x => x.Summary).HasMaxLength(300).IsRequired();
        builder.Property(x => x.Assignee).HasMaxLength(120);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(24);
        builder.Property(x => x.Priority).HasConversion<string>().HasMaxLength(16);
        builder.HasIndex(x => new { x.Status, x.DueAt });
    }
}

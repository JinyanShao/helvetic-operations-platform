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
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Reference).HasMaxLength(24).IsRequired();
        builder.HasIndex(x => x.Reference).IsUnique();
        builder.Property(x => x.Site).HasMaxLength(120).IsRequired();
        builder.Property(x => x.Summary).HasMaxLength(300).IsRequired();
        builder.Property(x => x.Assignee).HasMaxLength(120);
        builder.Property(x => x.CancellationReason).HasMaxLength(500);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(24).IsRequired();
        builder.Property(x => x.Priority).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(x => x.DueAt).HasColumnType("datetimeoffset").IsRequired();
        builder.Property(x => x.CreatedAt).HasColumnType("datetimeoffset").IsRequired();
        builder.Property(x => x.UpdatedAt).HasColumnType("datetimeoffset").IsRequired();
        builder.Property(x => x.Version).IsRowVersion();
        builder.HasIndex(x => new { x.Status, x.DueAt });
        builder.HasIndex(x => x.Priority);
        builder.HasIndex(x => x.Site);
        builder.HasIndex(x => x.CreatedAt);
    }
}

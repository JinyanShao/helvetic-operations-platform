using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HelveticOps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialWorkOrders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WorkOrders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Reference = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    Site = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Summary = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Priority = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    DueAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Assignee = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    CancellationReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkOrders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WorkOrderAuditEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WorkOrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventType = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    FromStatus = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: true),
                    ToStatus = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: true),
                    ActorObjectId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ActorDisplayName = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: true),
                    OccurredAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkOrderAuditEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkOrderAuditEvents_WorkOrders_WorkOrderId",
                        column: x => x.WorkOrderId,
                        principalTable: "WorkOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderAuditEvents_WorkOrderId_OccurredAt",
                table: "WorkOrderAuditEvents",
                columns: new[] { "WorkOrderId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_CreatedAt",
                table: "WorkOrders",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_Priority",
                table: "WorkOrders",
                column: "Priority");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_Reference",
                table: "WorkOrders",
                column: "Reference",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_Site",
                table: "WorkOrders",
                column: "Site");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_Status_DueAt",
                table: "WorkOrders",
                columns: new[] { "Status", "DueAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WorkOrderAuditEvents");

            migrationBuilder.DropTable(
                name: "WorkOrders");
        }
    }
}

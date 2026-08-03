using FluentValidation;
using HelveticOps.Api.Endpoints;
using HelveticOps.Domain.WorkOrders;

namespace HelveticOps.Api.Validation;

public sealed class WorkOrderQueryRequestValidator : AbstractValidator<WorkOrderQueryRequest>
{
    public WorkOrderQueryRequestValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
        RuleFor(x => x.Site).MaximumLength(120);
        RuleFor(x => x.Status).IsInEnum();
        RuleFor(x => x.Priority).IsInEnum();
        RuleFor(x => x.Sort).IsInEnum();
        RuleFor(x => x.Direction).IsInEnum();
    }
}

public sealed class CreateWorkOrderRequestValidator : AbstractValidator<CreateWorkOrderRequest>
{
    public CreateWorkOrderRequestValidator()
    {
        RuleFor(x => x.Reference).NotEmpty().MaximumLength(24);
        RuleFor(x => x.Site).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Summary).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Priority).IsInEnum();
        RuleFor(x => x.DueAt).NotEmpty();
    }
}

public sealed class UpdateWorkOrderRequestValidator : AbstractValidator<UpdateWorkOrderRequest>
{
    public UpdateWorkOrderRequestValidator()
    {
        RuleFor(x => x.Site).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Summary).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Priority).IsInEnum();
        RuleFor(x => x.DueAt).NotEmpty();
        RuleFor(x => x.Assignee).MaximumLength(120);
        RuleFor(x => x.Version).NotEmpty().Must(BeEightByteVersion).WithMessage("Version must be a Base64 rowversion value.");
    }

    private static bool BeEightByteVersion(string value) => TryDecode(value, out var bytes) && bytes.Length == 8;
    internal static bool TryDecode(string value, out byte[] bytes)
    {
        try { bytes = Convert.FromBase64String(value); return true; }
        catch (FormatException) { bytes = []; return false; }
    }
}

public sealed class TransitionWorkOrderRequestValidator : AbstractValidator<TransitionWorkOrderRequest>
{
    public TransitionWorkOrderRequestValidator()
    {
        RuleFor(x => x.TargetStatus).Must(x => x is WorkOrderStatus.Dispatched or WorkOrderStatus.InProgress
            or WorkOrderStatus.Blocked or WorkOrderStatus.Completed).WithMessage("TargetStatus is not an operational transition target.");
        RuleFor(x => x.Assignee).NotEmpty().When(x => x.TargetStatus == WorkOrderStatus.Dispatched).MaximumLength(120);
        RuleFor(x => x.Version).NotEmpty().Must(x => UpdateWorkOrderRequestValidator.TryDecode(x, out var bytes) && bytes.Length == 8)
            .WithMessage("Version must be a Base64 rowversion value.");
    }
}

public sealed class CancelWorkOrderRequestValidator : AbstractValidator<CancelWorkOrderRequest>
{
    public CancelWorkOrderRequestValidator()
    {
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Version).NotEmpty().Must(x => UpdateWorkOrderRequestValidator.TryDecode(x, out var bytes) && bytes.Length == 8)
            .WithMessage("Version must be a Base64 rowversion value.");
    }
}

using HelveticOps.Application.WorkOrders;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace HelveticOps.Api.Errors;

public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        var (status, title, detail) = exception switch
        {
            WorkOrderNotFoundException => (StatusCodes.Status404NotFound, "Work order not found", exception.Message),
            WorkOrderConcurrencyException => (StatusCodes.Status409Conflict, "Work order changed", "Reload the work order and reapply your changes."),
            HelveticOps.Domain.WorkOrders.WorkOrderInvalidTransitionException => (StatusCodes.Status409Conflict, "Work-order conflict", "The requested lifecycle change is not allowed."),
            HelveticOps.Domain.WorkOrders.WorkOrderValidationException validation => (StatusCodes.Status400BadRequest, "Invalid work-order operation", validation.Message),
            WorkOrderVersionFormatException => (StatusCodes.Status400BadRequest, "Invalid work-order operation", "Version must be a Base64 rowversion value."),
            _ => (StatusCodes.Status500InternalServerError, "Unexpected server error", "An unexpected error occurred.")
        };
        if (status == 500) logger.LogError(exception, "Unhandled API exception for {Path}", context.Request.Path);
        else logger.LogInformation(exception, "Mapped API exception to {StatusCode} for {Path}", status, context.Request.Path);

        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = detail,
            Type = $"https://www.rfc-editor.org/rfc/rfc9110#status.{status}",
            Instance = context.Request.Path
        }, options: null, contentType: "application/problem+json", cancellationToken);
        return true;
    }
}

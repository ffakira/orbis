output "invoke_arn" {
  description = "API Lambda invocation ARN"
  value       = aws_lambda_function.api.invoke_arn
}

output "function_name" {
  description = "API Lambda function name"
  value       = aws_lambda_function.api.function_name
}

output "outbox_function_name" {
  description = "Outbox Lambda function name"
  value       = aws_lambda_function.outbox.function_name
}

output "outbox_invoke_arn" {
  description = "Outbox Lambda invocation ARN"
  value       = aws_lambda_function.outbox.invoke_arn
}

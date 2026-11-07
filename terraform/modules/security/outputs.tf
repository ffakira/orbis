output "execution_role_arn" {
  description = "API Lambda execution role ARN"
  value       = aws_iam_role.lambda_execution_role.arn
}

output "outbox_execution_role_arn" {
  description = "Outbox Lambda execution role ARN"
  value       = aws_iam_role.outbox_lambda_execution_role.arn
}

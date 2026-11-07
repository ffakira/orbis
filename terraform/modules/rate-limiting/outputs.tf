output "table_name" {
  description = "Registration rate-limit table name"
  value       = aws_dynamodb_table.registration_rate_limits.name
}

output "table_arn" {
  description = "Registration rate-limit table ARN"
  value       = aws_dynamodb_table.registration_rate_limits.arn
}

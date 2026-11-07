output "api_url" {
  description = "Public URL of the HTTP API"
  value       = aws_apigatewayv2_api.api.api_endpoint
}

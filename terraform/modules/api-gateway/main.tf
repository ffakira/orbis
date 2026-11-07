resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id = aws_apigatewayv2_api.api.id

  integration_type = "AWS_PROXY"
  integration_uri  = var.lambda_invoke_arn

  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "default" {
  api_id = aws_apigatewayv2_api.api.id

  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "registration" {
  api_id = aws_apigatewayv2_api.api.id

  route_key = "POST /identity/register"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id = aws_apigatewayv2_api.api.id

  name        = "$default"
  auto_deploy = true

  route_settings {
    route_key = aws_apigatewayv2_route.registration.route_key

    throttling_rate_limit  = var.registration_throttling_rate_limit
    throttling_burst_limit = var.registration_throttling_burst_limit
  }
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id = "AllowExecutionFromAPIGateway"

  action = "lambda:InvokeFunction"

  function_name = var.lambda_function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

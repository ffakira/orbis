resource "aws_lambda_function" "api" {
  function_name = "${var.project_name}-api"
  description   = "Restaurant CMV API"

  filename         = var.package_path
  source_code_hash = var.source_code_hash

  role = var.execution_role_arn

  runtime = "nodejs22.x"
  handler = "dist/lambda.handler"

  memory_size = 256
  timeout     = 15

  layers = [
    "arn:aws:lambda:us-east-1:177933569100:layer:AWS-Parameters-and-Secrets-Lambda-Extension:171"
  ]

  environment {
    variables = {
      NODE_ENV                 = "production"
      LOG_LEVEL                = "info"
      DB_SECRET_ARN            = var.database_secret_arn
      TERMS_OF_SERVICE_VERSION = var.terms_of_service_version

      REGISTRATION_RATE_LIMIT_TABLE_NAME     = var.rate_limit_table_name
      REGISTRATION_RATE_LIMIT_MAX_ATTEMPTS   = tostring(var.rate_limit_max_attempts)
      REGISTRATION_RATE_LIMIT_WINDOW_SECONDS = tostring(var.rate_limit_window_seconds)
    }
  }
}

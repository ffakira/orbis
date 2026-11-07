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
      NODE_ENV                  = "production"
      LOG_LEVEL                 = "info"
      DB_SECRET_ARN             = var.database_secret_arn
      AUTHENTICATION_SECRET_ARN = var.authentication_secret_arn
      TERMS_OF_SERVICE_VERSION  = var.terms_of_service_version

      REGISTRATION_RATE_LIMIT_TABLE_NAME     = var.rate_limit_table_name
      REGISTRATION_RATE_LIMIT_MAX_ATTEMPTS   = tostring(var.rate_limit_max_attempts)
      REGISTRATION_RATE_LIMIT_WINDOW_SECONDS = tostring(var.rate_limit_window_seconds)

      EMAIL_VERIFICATION_SECRET_ARN = var.email_verification_secret_arn
    }
  }
}

resource "aws_lambda_function" "outbox" {
  function_name = "${var.project_name}-outbox"
  description   = "Processes pending outbox events"

  filename         = var.package_path
  source_code_hash = var.source_code_hash

  role = var.outbox_execution_role_arn

  runtime = "nodejs22.x"
  handler = "dist/outbox-lambda.handler"

  memory_size = 256
  timeout     = 60

  reserved_concurrent_executions = 1

  layers = [
    "arn:aws:lambda:us-east-1:177933569100:layer:AWS-Parameters-and-Secrets-Lambda-Extension:171"
  ]

  environment {
    variables = {
      NODE_ENV      = "production"
      LOG_LEVEL     = "info"
      DB_SECRET_ARN = var.database_secret_arn

      EMAIL_VERIFICATION_SECRET_ARN = var.email_verification_secret_arn
      RESEND_SECRET_ARN             = var.resend_secret_arn

      EMAIL_FROM_ADDRESS = var.email_from_address
      PUBLIC_APP_URL     = var.public_app_url

      OUTBOX_BATCH_SIZE          = "25"
      OUTBOX_LEASE_DURATION_MS   = "60000"
      OUTBOX_MAX_ATTEMPTS        = "10"
      OUTBOX_RETRY_BASE_DELAY_MS = "1000"
      OUTBOX_RETRY_MAX_DELAY_MS  = "900000"
    }
  }
}

resource "aws_cloudwatch_event_rule" "outbox_schedule" {
  name                = "${var.project_name}-outbox-schedule"
  description         = "Periodically processes pending outbox events"
  schedule_expression = var.outbox_schedule_expression
  state               = "ENABLED"
}

resource "aws_cloudwatch_event_target" "outbox" {
  rule      = aws_cloudwatch_event_rule.outbox_schedule.name
  target_id = "outbox-lambda"
  arn       = aws_lambda_function.outbox.arn
}

resource "aws_lambda_permission" "allow_eventbridge_outbox" {
  statement_id  = "AllowEventBridgeOutboxInvocation"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.outbox.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.outbox_schedule.arn
}

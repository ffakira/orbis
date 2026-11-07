data "archive_file" "lambda" {
  type = "zip"

  source_dir  = "${path.module}/../build"
  output_path = "${path.module}/lambda.zip"
}

data "aws_secretsmanager_secret" "application" {
  name = var.application_secret_name
}

module "rate_limiting" {
  source = "./modules/rate-limiting"

  project_name = var.project_name
}

module "security" {
  source = "./modules/security"

  project_name           = var.project_name
  application_secret_arn = data.aws_secretsmanager_secret.application.arn
  rate_limit_table_arn   = module.rate_limiting.table_arn
}

module "lambda" {
  source = "./modules/lambda"

  project_name = var.project_name

  package_path     = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  execution_role_arn        = module.security.execution_role_arn
  outbox_execution_role_arn = module.security.outbox_execution_role_arn

  application_secret_arn = data.aws_secretsmanager_secret.application.arn

  terms_of_service_version = var.terms_of_service_version

  rate_limit_table_name     = module.rate_limiting.table_name
  rate_limit_max_attempts   = var.registration_rate_limit_max_attempts
  rate_limit_window_seconds = var.registration_rate_limit_window_seconds

  outbox_schedule_expression = var.outbox_schedule_expression

  email_from_address = var.email_from_address
  public_app_url     = var.public_app_url

  depends_on = [
    module.security
  ]
}

module "api_gateway" {
  source = "./modules/api-gateway"

  project_name = var.project_name

  lambda_invoke_arn    = module.lambda.invoke_arn
  lambda_function_name = module.lambda.function_name

  registration_throttling_rate_limit  = var.registration_throttling_rate_limit
  registration_throttling_burst_limit = var.registration_throttling_burst_limit
}

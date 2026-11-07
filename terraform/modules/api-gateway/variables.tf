variable "project_name" {
  type = string
}

variable "lambda_invoke_arn" {
  type = string
}

variable "lambda_function_name" {
  type = string
}

variable "registration_throttling_rate_limit" {
  type = number
}

variable "registration_throttling_burst_limit" {
  type = number
}

variable "project_name" {
  type = string
}

variable "application_secret_arn" {
  description = "ARN of the consolidated application secret"
  type        = string
}

variable "rate_limit_table_arn" {
  type = string
}

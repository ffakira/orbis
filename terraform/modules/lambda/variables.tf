variable "project_name" {
  type = string
}

variable "package_path" {
  type = string
}

variable "source_code_hash" {
  type = string
}

variable "execution_role_arn" {
  type = string
}

variable "database_secret_arn" {
  type = string
}

variable "authentication_secret_arn" {
  type = string
}

variable "terms_of_service_version" {
  type = string
}

variable "rate_limit_table_name" {
  type = string
}

variable "rate_limit_max_attempts" {
  type = number
}

variable "rate_limit_window_seconds" {
  type = number
}

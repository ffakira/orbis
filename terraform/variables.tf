variable "aws_region" {
  description = "AWS region where the infrastructure will be deployed"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used as a resource prefix"
  type        = string
  default     = "restaurant-cmv-api"
}

variable "application_secret_name" {
  description = "Secrets Manager name containing all application credentials"
  type        = string
  default     = "restaurant-cmv-api/application"
}

variable "terms_of_service_version" {
  description = "Version identifier of the published Terms of Service"
  type        = string

  validation {
    condition     = length(trimspace(var.terms_of_service_version)) > 0
    error_message = "A Terms of Service version must be provided."
  }
}

variable "registration_throttling_rate_limit" {
  description = "Maximum sustained registration requests per second"
  type        = number
  default     = 2

  validation {
    condition     = var.registration_throttling_rate_limit > 0
    error_message = "Registration throttling rate limit must be greater than zero."
  }
}

variable "registration_throttling_burst_limit" {
  description = "Maximum registration request burst capacity"
  type        = number
  default     = 5

  validation {
    condition     = var.registration_throttling_burst_limit > 0
    error_message = "Registration throttling burst limit must be greater than zero."
  }
}

variable "registration_rate_limit_max_attempts" {
  description = "Maximum registration attempts allowed from one IP address within the rate limit window"
  type        = number
  default     = 5

  validation {
    condition = (
      var.registration_rate_limit_max_attempts > 0 &&
      floor(var.registration_rate_limit_max_attempts) == var.registration_rate_limit_max_attempts
    )
    error_message = "Registration rate limit max attempts must be a positive integer."
  }
}

variable "registration_rate_limit_window_seconds" {
  description = "Duration of the per-IP registration rate limit window in seconds"
  type        = number
  default     = 900

  validation {
    condition = (
      var.registration_rate_limit_window_seconds > 0 &&
      floor(var.registration_rate_limit_window_seconds) == var.registration_rate_limit_window_seconds
    )
    error_message = "Registration rate limit window must be a positive integer."
  }
}

variable "email_from_address" {
  description = "Verified sender email address used by the outbox worker"
  type        = string

  validation {
    condition     = can(regex("^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$", var.email_from_address))
    error_message = "The email_from_address must be a valid email address."
  }
}

variable "public_app_url" {
  description = "Public HTTPS application URL used when generating email links"
  type        = string

  validation {
    condition     = startswith(trimspace(var.public_app_url), "https://")
    error_message = "The public_app_url must use HTTPS."
  }
}

variable "outbox_schedule_expression" {
  description = "EventBridge schedule expression for processing pending outbox events"
  type        = string
  default     = "rate(1 minute)"

  validation {
    condition     = length(trimspace(var.outbox_schedule_expression)) > 0
    error_message = "The outbox schedule expression must not be empty."
  }
}

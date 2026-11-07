resource "aws_dynamodb_table" "registration_rate_limits" {
  name         = "${var.project_name}-registration-rate-limits"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "rate_limit_key"
  range_key = "window_start"

  attribute {
    name = "rate_limit_key"
    type = "S"
  }

  attribute {
    name = "window_start"
    type = "N"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name      = "${var.project_name}-registration-rate-limits"
    ManagedBy = "Terraform"
  }
}

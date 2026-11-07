variable "verification_app_domain" {
  description = "Public domain used for the email verification page"
  type        = string
  default     = "app.fluxante.com.br"

  validation {
    condition     = can(regex("^[a-z0-9.-]+$", var.verification_app_domain))
    error_message = "The verification app domain must be a valid lowercase DNS name."
  }
}

data "aws_route53_zone" "public" {
  name         = "fluxante.com.br."
  private_zone = false
}

resource "aws_acm_certificate" "verification_app" {
  domain_name       = var.verification_app_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "${var.project_name}-verification-app"
    Environment = "production"
  }
}

resource "aws_route53_record" "verification_app_certificate_validation" {
  for_each = {
    for option in aws_acm_certificate.verification_app.domain_validation_options :
    option.domain_name => {
      name   = option.resource_record_name
      type   = option.resource_record_type
      record = option.resource_record_value
    }
  }

  zone_id         = data.aws_route53_zone.public.zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "verification_app" {
  certificate_arn = aws_acm_certificate.verification_app.arn

  validation_record_fqdns = [
    for record in aws_route53_record.verification_app_certificate_validation :
    record.fqdn
  ]
}

output "verification_app_certificate_arn" {
  description = "Issued ACM certificate ARN for the verification application"
  value       = aws_acm_certificate_validation.verification_app.certificate_arn
}

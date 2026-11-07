terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket       = "orbis-terraform-state-450753703757-us-east-1"
    key          = "orbis/production/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }

    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
  }
}

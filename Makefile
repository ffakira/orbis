
.DEFAULT_GOAL := help

SHELL := /bin/bash

PROJECT_NAME := restaurant-cmv-api
AWS_REGION := us-east-1
LAMBDA_NAME := $(PROJECT_NAME)-api
API_URL := https://siiuax65yc.execute-api.us-east-1.amazonaws.com
TERRAFORM_DIR := terraform
BUILD_DIR := build

.PHONY: help install dev test build package clean \
        terraform-fmt terraform-validate terraform-plan \
        terraform-apply terraform-output \
        deploy logs status health ready check

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
	awk 'BEGIN {FS = ":.*?## "}; {printf "  make %-20s %s\n", $$1, $$2}'

install: ## Install project dependencies
	npm ci

dev: ## Start local development server
	npm run dev

test: ## Run test suite
	npm test

build: ## Compile TypeScript
	npm run build

package: build ## Build Lambda deployment package
	rm -rf $(BUILD_DIR)
	mkdir -p $(BUILD_DIR)
	cp -r dist $(BUILD_DIR)/
	cp package.json package-lock.json $(BUILD_DIR)/
	npm ci --omit=dev --prefix $(BUILD_DIR)

clean: ## Remove generated files
	rm -rf dist $(BUILD_DIR) $(TERRAFORM_DIR)/lambda.zip

terraform-fmt: ## Format Terraform files
	terraform -chdir=$(TERRAFORM_DIR) fmt -recursive

terraform-validate: ## Validate Terraform configuration
	terraform -chdir=$(TERRAFORM_DIR) validate

terraform-plan: package ## Build package and preview infrastructure changes
	terraform -chdir=$(TERRAFORM_DIR) plan

terraform-apply: package ## Build package and apply infrastructure changes
	terraform -chdir=$(TERRAFORM_DIR) apply

terraform-output: ## Display Terraform outputs
	terraform -chdir=$(TERRAFORM_DIR) output

deploy: test terraform-fmt terraform-validate terraform-apply ## Test, build and deploy

logs: ## Tail Lambda CloudWatch logs
	aws logs tail /aws/lambda/$(LAMBDA_NAME) \
		--region $(AWS_REGION) \
		--since 10m \
		--follow

status: ## Show Lambda configuration status
	aws lambda get-function-configuration \
		--function-name $(LAMBDA_NAME) \
		--region $(AWS_REGION) \
		--query '{State:State,Runtime:Runtime,Layers:Layers[*].Arn}'

health: ## Check API health endpoint
	curl -i $(API_URL)/health

ready: ## Check API and PostgreSQL connectivity
	curl -i $(API_URL)/ready

check: health ready ## Check both API health and database readiness

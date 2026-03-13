terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# --- Variables ---
variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
  default     = "learnhub-api"
}

variable "database_password" {
  description = "Password for the postgres user"
  type        = string
  sensitive   = true
}

# --- Cloud SQL ---
resource "google_sql_database_instance" "instance" {
  name             = "learnhub-db"
  region           = var.region
  database_version = "POSTGRES_15"
  settings {
    tier = "db-f1-micro"
    ip_configuration {
      ipv4_enabled = true
    }
  }
  deletion_protection = false # Set to true for production
}

resource "google_sql_database" "database" {
  name     = "gemini_hack"
  instance = google_sql_database_instance.instance.name
}

resource "google_sql_user" "users" {
  name     = "postgres"
  instance = google_sql_database_instance.instance.name
  password = var.database_password
}

# --- Cloud Run ---
resource "google_cloud_run_v2_service" "service" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      max_instance_count = 2
      min_instance_count = 0
    }

    containers {
      image = "gcr.io/${var.project_id}/${var.service_name}:latest" # Assumes image exists
      
      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "DATABASE_URL"
        value = "postgresql://postgres:${var.database_password}@localhost/gemini_hack?host=/cloudsql/${google_sql_database_instance.instance.connection_name}"
      }

      # Add other environment variables here or via a secret manager
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.instance.connection_name]
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [google_sql_database_instance.instance]
}

# --- IAM ---
resource "google_cloud_run_v2_service_iam_member" "noauth" {
  location = google_cloud_run_v2_service.service.location
  name     = google_cloud_run_v2_service.service.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# --- Outputs ---
output "service_url" {
  value = google_cloud_run_v2_service.service.uri
}

output "db_connection_name" {
  value = google_sql_database_instance.instance.connection_name
}

########################################
# 1) PROVIDER CONFIG & VARIABLES
########################################

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.9.0" # or whichever newer version you prefer
    }
  }
  required_version = ">= 1.0.0"
}

provider "aws" {
  region = "us-east-1"
}

variable "s3_input_bucket" {
  type    = string
  default = "whisper-bucket-unilex-new"
}

# Update the key to store the file as whisper_deploy.ipynb
variable "s3_input_key" {
  type    = string
  default = "input/whisper_deploy.ipynb"
}

variable "s3_output_bucket" {
  type    = string
  default = "whisper-output-unilex"
}

variable "processing_image_uri" {
  description = "ECR URI of the custom container with papermill"
  type        = string
  default     = "307946674662.dkr.ecr.us-east-1.amazonaws.com/my-sagemaker-processing:latest"
}

variable "processing_job_name" {
  type    = string
  default = "my-notebook-processing-job"
}

########################################
# 1.1) LOCALS
########################################
locals {
  # Remove colons from the timestamp to form a valid job name
  job_name_suffix = replace(timestamp(), ":", "")
  full_job_name   = "${var.processing_job_name}-${local.job_name_suffix}"
}

########################################
# 2) CREATE S3 BUCKET + UPLOAD .ipynb
########################################

# (A) Create the S3 bucket
resource "aws_s3_bucket" "notebook_bucket" {
  bucket = var.s3_input_bucket
}

resource "aws_s3_bucket" "notebook_output_bucket" {
  bucket = var.s3_output_bucket
}

# (B) Upload the .ipynb file (as whisper_deploy.ipynb) as an S3 object
resource "aws_s3_bucket_object" "notebook_file" {
  bucket = aws_s3_bucket.notebook_bucket.bucket
  key    = var.s3_input_key          # This will be "input/whisper_deploy.ipynb"
  source = "../whisper_deploy.ipynb" # local path to your notebook file

  # Ensure updates when the local file changes
  etag = filemd5("../whisper_deploy.ipynb")
}

########################################
# 3) IAM ROLE FOR SAGEMAKER PROCESSING
########################################

data "aws_iam_policy_document" "sagemaker_processing_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["sagemaker.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "sagemaker_processing_role" {
  name               = "tofu-sagemaker-processing-role"
  assume_role_policy = data.aws_iam_policy_document.sagemaker_processing_assume_role.json
}

resource "aws_iam_role_policy_attachment" "sagemaker_full_access" {
  role       = aws_iam_role.sagemaker_processing_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSageMakerFullAccess"
}

resource "aws_iam_role_policy_attachment" "s3_rw_access" {
  role       = aws_iam_role.sagemaker_processing_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

########################################
# 4) NULL RESOURCE: CREATE SAGEMAKER PROCESSING JOB
########################################

resource "null_resource" "create_sagemaker_processing_job" {
  # Using a trigger with the current timestamp forces this resource to re-run at each apply.
  triggers = {
    always_run = timestamp()
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -x
      echo "Creating SageMaker Processing Job: ${local.full_job_name}"

      aws sagemaker create-processing-job \
        --region us-east-1 \
        --processing-job-name "${local.full_job_name}" \
        --role-arn "${aws_iam_role.sagemaker_processing_role.arn}" \
        --app-specification ImageUri=${var.processing_image_uri} \
        --processing-resources '{
          "ClusterConfig": {
            "InstanceCount": 1,
            "InstanceType": "ml.m5.large",
            "VolumeSizeInGB": 20
          }
        }' \
        --processing-inputs '[
          {
            "InputName": "input-notebook",
            "S3Input": {
              "S3Uri": "s3://${var.s3_input_bucket}/${var.s3_input_key}",
              "LocalPath": "/opt/ml/processing/input",
              "S3DataType": "S3Prefix",
              "S3InputMode": "File"
            }
          }
        ]' \
        --processing-output-config '{
          "Outputs": [
            {
              "OutputName": "notebook-output",
              "S3Output": {
                "S3Uri": "s3://${var.s3_output_bucket}/",
                "LocalPath": "/opt/ml/processing/output",
                "S3UploadMode": "EndOfJob"
              }
            }
          ]
        }' \
        --network-config '{
          "EnableNetworkIsolation": false
        }' || { echo "Error: SageMaker processing job creation failed"; exit 1; }

      echo "Processing job submitted!"
    EOT
  }

  depends_on = [
    aws_s3_bucket_object.notebook_file,
    aws_iam_role_policy_attachment.sagemaker_full_access,
    aws_iam_role_policy_attachment.s3_rw_access
  ]
}

########################################
# 5) OUTPUT
########################################

output "processing_job_name" {
  value = local.full_job_name
}

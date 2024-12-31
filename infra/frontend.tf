terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Configure the AWS Provider
provider "aws" {
  profile = "iamramin"
  region  = "ca-central-1"
}

locals {
  website_files = fileset(var.website_root, "**")
  mime_types    = jsondecode(file("mime.json"))
}

# Create S3 bucket with appropriate policies
resource "aws_s3_bucket" "website_bucket" {
  bucket        = var.bucket_name
  force_destroy = true
}
resource "aws_s3_bucket_acl" "website_bucket_acl" {
  depends_on = [
    aws_s3_bucket_ownership_controls.website_bucket_ownership,
    aws_s3_bucket_public_access_block.website_bucket_public_access,
  ]
  bucket = aws_s3_bucket.website_bucket.id
  acl    = "private"
}
resource "aws_s3_bucket_ownership_controls" "website_bucket_ownership" {
  bucket = aws_s3_bucket.website_bucket.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}
resource "aws_s3_bucket_public_access_block" "website_bucket_public_access" {
  bucket = aws_s3_bucket.website_bucket.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# configure S3 bucket for website hosting
resource "aws_s3_bucket_website_configuration" "website_bucket_config" {
  bucket = aws_s3_bucket.website_bucket.id
  index_document {
    suffix = var.website_index_document
  }
  routing_rules = jsonencode([
    {
      "Condition" : {
        "KeyPrefixEquals" : "login"
      },
      "Redirect" : {
        "ReplaceKeyWith" : "index.html"
      }
    },
    {
      "Condition" : {
        "KeyPrefixEquals" : "whiteboard"
      },
      "Redirect" : {
        "ReplaceKeyWith" : "main.html"
      }
    }
  ])
}

# PUT all website files into bucket
resource "aws_s3_object" "file" {
  for_each = local.website_files

  bucket       = aws_s3_bucket.website_bucket.id
  key          = each.key
  source       = "${var.website_root}/${each.key}"
  source_hash  = filemd5("${var.website_root}/${each.key}")
  acl          = "public-read"
  content_type = lookup(local.mime_types, regex("\\.[^.]+$", each.key), null)
}


resource "aws_cloudfront_distribution" "s3_distribution" {
  origin {
    domain_name = aws_s3_bucket.website_bucket.bucket_regional_domain_name
    origin_id   = var.bucket_name
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = var.website_index_document

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = var.bucket_name

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "allow-all"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}

resource "aws_s3_bucket_policy" "website_bucket_policy" {
  bucket = aws_s3_bucket.website_bucket.id
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : {
      "Sid" : "AllowCloudFrontServicePrincipalReadOnly",
      "Effect" : "Allow",
      "Principal" : {
        "Service" : "cloudfront.amazonaws.com"
      },
      "Action" : "s3:GetObject",
      "Resource" : "${aws_s3_bucket.website_bucket.arn}/*",
      "Condition" : {
        "StringEquals" : {
          "AWS:SourceArn" : aws_cloudfront_distribution.s3_distribution.arn
        }
      }
    }
  })
}


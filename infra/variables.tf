variable "website_root" {
  type        = string
  description = "Path to the root of website content"
  default     = "../Public"
}

variable "bucket_name" {
  type = string
  description = "Name of S3 bucket"
  default = "collaborative-whiteboard-q9jxs64y"
}

variable "website_index_document" {
  type = string
  description = "The websites index document"
  default = "index.html"
}
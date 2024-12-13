output "s3_bucket_name" {
  value = aws_s3_bucket.website_bucket.id
}

output "cloudfront_distribution_domain_name" {
  value = aws_cloudfront_distribution.s3_distribution.domain_name
}

# output "user_pool_id" {
#   value = aws_cognito_user_pool.users.id
# }

# output "app_client_id" {
#   value = aws_cognito_user_pool_client.whiteboardclient.id
# }
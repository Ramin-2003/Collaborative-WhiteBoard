# resource "aws_cognito_user_pool" "users" {
#   name = "whiteboardpool"
#   username_attributes = ["email"]
#   username_configuration {
#     case_sensitive = false
#   }
#   schema {
#     name = "preferred_username"
#     attribute_data_type = "String"
#     mutable = true
#     developer_only_attribute = false
#     required = true
#     string_attribute_constraints {
#       min_length = 4
#       max_length = 13
#     }
#   }
#   password_policy {
#     minimum_length    = 8
#     require_lowercase = true
#     require_numbers   = true
#     require_symbols   = false
#     require_uppercase = true
#   }
# }

# resource "aws_cognito_user_pool_client" "client" {
#   name = "whiteboardclient"
#   user_pool_id = aws_cognito_user_pool.users.id
#   generate_secret = false
#   prevent_user_existence_errors = true
# }

#####################################

resource "aws_vpc" "main" {
  cidr_block                       = "10.0.0.0/16"
  enable_dns_hostnames             = true
  enable_dns_support               = true
  assign_generated_ipv6_cidr_block = true
}

data "aws_availability_zones" "available" {}
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index}.0/24"
  ipv6_cidr_block         = cidrsubnet(aws_vpc.main.ipv6_cidr_block, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
}
resource "aws_subnet" "private" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 2}.0/24"
  ipv6_cidr_block         = cidrsubnet(aws_vpc.main.ipv6_cidr_block, 8, count.index + 2)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = false
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}

# Public Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  route {
    ipv6_cidr_block = "::/0"
    gateway_id      = aws_internet_gateway.main.id
  }
}

# Route table associations
resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Egress-Only Internet Gateway for Private Subnets
resource "aws_egress_only_internet_gateway" "private" {
  vpc_id = aws_vpc.main.id
}

# Private Route Table
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    ipv6_cidr_block        = "::/0"
    egress_only_gateway_id = aws_egress_only_internet_gateway.private.id
  }
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# Security Groups
resource "aws_security_group" "alb_security" {
  name        = "alb-security-group"
  description = "Allow traffic to ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port        = 80
    to_port          = 80
    protocol         = "tcp"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }
}

resource "aws_security_group" "ecs_security" {
  name        = "whiteboard-security"
  description = "Allow traffic for whiteboard ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port        = 10000
    to_port          = 10000
    protocol         = "tcp"
    security_groups  = [aws_security_group.alb_security.id]
    ipv6_cidr_blocks = []
  }

  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }
}

# Create Application Load Balancer (ALB) in Public Subnet
resource "aws_lb" "main" {
  name               = "whiteboard-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_security.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection       = false
  enable_cross_zone_load_balancing = true
  idle_timeout                     = 150
}

# ALB Listener
resource "aws_lb_listener" "websocket" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80 # Or 443 for HTTPS
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ecs_target_group.arn
  }
}

# Target Group for ECS
resource "aws_lb_target_group" "ecs_target_group" {
  name        = "whiteboard-ecs-target-group"
  port        = 10000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    interval            = 30
    port                = 10000
    path                = "/health"
    protocol            = "HTTP"
    timeout             = 5
    healthy_threshold   = 3
    unhealthy_threshold = 3
  }
}

resource "aws_ecs_cluster" "ecs_cluster" {
  name = "whiteboard-cluster"
}

resource "aws_iam_role" "ecs_execution_role" { # ecs permission
  name = "ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}
resource "aws_iam_role_policy_attachment" "ecs_execution_logs_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task_role" { # ecs app permissions
  name = "ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}
resource "aws_iam_role_policy_attachment" "ecs_custom_policy" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

resource "aws_ecs_task_definition" "ecs_task" {
  family                   = "whiteboard-task"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn
  network_mode             = "awsvpc"
  requires_compatibilities = ["EC2"]

  container_definitions = jsonencode([{
    name      = "whiteboard-container"
    image     = "public.ecr.aws/e3m8x5b2/raminsarwer/collaborative-whiteboard:latest"
    cpu       = 256
    memory    = 512
    essential = true
    portMappings = [{
      containerPort = 10000
      hostPort      = 10000
    }]
  }])
}

resource "aws_iam_role" "ecs_instance_role" {
  name = "ecs-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Service = "ec2.amazonaws.com"
        },
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "ecs_instance_profile" {
  name = "ecs-instance-profile"
  role = aws_iam_role.ecs_instance_role.name
}

resource "aws_iam_role_policy_attachment" "ecs_instance_role_policy" {
  role       = aws_iam_role.ecs_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

# Define the Launch Template
# Update launch template network configuration
resource "aws_launch_template" "ecs_launch_template" {
  name_prefix   = "ecs-launch-template-"
  image_id      = "ami-06c25f94794174d3d"
  instance_type = "t2.micro"

  iam_instance_profile {
    name = aws_iam_instance_profile.ecs_instance_profile.name
  }

  user_data = base64encode(<<-EOF
              #!/bin/bash
              echo ECS_CLUSTER=whiteboard-cluster >> /etc/ecs/ecs.config
              EOF
  )

  network_interfaces {
    device_index                = 0
    associate_public_ip_address = true
    security_groups             = [aws_security_group.ecs_security.id]
  }
}

# Define the Auto Scaling Group
resource "aws_autoscaling_group" "ecs_asg" {
  desired_capacity    = 1
  max_size            = 1
  min_size            = 1
  vpc_zone_identifier = aws_subnet.public[*].id # Changed to public subnets

  launch_template {
    id      = aws_launch_template.ecs_launch_template.id
    version = "$Latest"
  }
}

resource "aws_ecs_service" "ecs_service" {
  name            = "whiteboard-service"
  cluster         = aws_ecs_cluster.ecs_cluster.id
  task_definition = aws_ecs_task_definition.ecs_task.arn
  desired_count   = 1
  launch_type     = "EC2"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs_security.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.ecs_target_group.arn
    container_name   = "whiteboard-container"
    container_port   = 10000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = false
  }
}


resource "aws_dynamodb_table" "room_data" {
  name         = "whiteboard"
  billing_mode = "PROVISIONED" # Use provisioned capacity
  hash_key     = "room_code"   # Partition Key

  read_capacity  = 2 # Allocate read capacity (within free tier)
  write_capacity = 2 # Allocate write capacity (within free tier)

  attribute {
    name = "room_code"
    type = "S" # String
  }
}

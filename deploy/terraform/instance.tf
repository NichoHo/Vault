# ponytail: single instance, no ASG/ALB/RDS — swap in ECS+RDS if the demo needs HA.

# ---------------------------------------------------------------------------
# Vault — EC2 instance
# ---------------------------------------------------------------------------

# ── Latest Amazon Linux 2023 AMI ─────────────────────────────────────────────

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

# ── EC2 Instance ─────────────────────────────────────────────────────────────

resource "aws_instance" "vault" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.vault.id]
  subnet_id              = data.aws_subnets.default.ids[0]

  associate_public_ip_address = true

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  user_data = <<-EOF
    #!/bin/bash
    set -euo pipefail

    # ── Install Docker ───────────────────────────────────────────────────
    dnf update -y
    dnf install -y docker git
    systemctl enable --now docker
    usermod -aG docker ec2-user

    # ── Install Docker Compose plugin ────────────────────────────────────
    mkdir -p /usr/local/lib/docker/cli-plugins
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | head -1 | cut -d'"' -f4)
    curl -SL "https://github.com/docker/compose/releases/download/$${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

    # ── Clone repo & start services ──────────────────────────────────────
    cd /home/ec2-user
    git clone ${var.repo_url} vault
    chown -R ec2-user:ec2-user vault
    cd vault
    docker compose up -d
  EOF

  tags = {
    Name    = "vault-server"
    Project = "vault"
  }
}

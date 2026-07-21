# ---------------------------------------------------------------------------
# Vault — security group (default VPC)
# ---------------------------------------------------------------------------

resource "aws_security_group" "vault" {
  name        = "vault-sg"
  description = "Allow SSH, HTTP, HTTPS, and app traffic"
  vpc_id      = data.aws_vpc.default.id

  tags = {
    Name    = "vault-sg"
    Project = "vault"
  }
}

# ── Ingress rules ────────────────────────────────────────────────────────────

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  security_group_id = aws_security_group.vault.id
  description       = "SSH"
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "http" {
  security_group_id = aws_security_group.vault.id
  description       = "HTTP"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id = aws_security_group.vault.id
  description       = "HTTPS"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "app" {
  security_group_id = aws_security_group.vault.id
  description       = "Next.js app"
  from_port         = 3000
  to_port           = 3000
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
}

# ── Egress rule ──────────────────────────────────────────────────────────────

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.vault.id
  description       = "Allow all outbound"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

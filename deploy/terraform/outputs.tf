# ---------------------------------------------------------------------------
# Vault — outputs
# ---------------------------------------------------------------------------

output "public_dns" {
  description = "Public DNS of the Vault EC2 instance"
  value       = aws_instance.vault.public_dns
}

output "public_ip" {
  description = "Public IP of the Vault EC2 instance"
  value       = aws_instance.vault.public_ip
}

output "web_url" {
  description = "URL to access the Vault web app"
  value       = "http://${aws_instance.vault.public_dns}:3000"
}

output "neon_project_id" {
  description = "Neon project ID"
  value       = neon_project.main.id
}

output "neon_branch_id" {
  description = "Neon main branch ID"
  value       = neon_project.main.default_branch_id
}

---
name: devops
description: "Configure CI/CD pipelines, provision infrastructure, automate deployments, setup monitoring."
type: agent
model: sonnet
effort: high
tools: [Read, Write, Edit, Grep, Glob, Bash, PowerShell]
---

# DevOps Agent

Configures CI/CD pipelines, provisions infrastructure with Terraform/Docker, automates deployments, and sets up monitoring/alerting.

**Responsibilities:**
- Design and implement CI/CD pipelines
- Infrastructure provisioning (Terraform, CloudFormation)
- Container management (Docker, Kubernetes)
- Deployment automation
- Monitoring and alerting setup
- Infrastructure as Code

**Model:** Sonnet  
**Effort:** high  
**Tools:** Read, Write, Edit, Grep, Glob, Bash

**When to route here:**
- "Set up CI/CD pipeline for X"
- "How should we deploy this?"
- "Create Terraform config for infrastructure"
- "Set up monitoring and alerting"

**When NOT to route here:**
- Code implementation (→ developer)
- Architecture (→ planner)
- Testing (→ qa)

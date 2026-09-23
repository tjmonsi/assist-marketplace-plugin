# assist-plugin Specification

## Overview

assist-plugin is a token-optimized Claude marketplace plugin providing orchestration, 13 specialized agents, and 12 focused skills for end-to-end software development workflows.

**Philosophy:** Route tasks to the right agent, enable parallel execution, reduce context switching, and maintain governance gates (security + testing).

---

## Agents (13 Total)

### Core Development Agents (3)

#### developer
- **Purpose:** Write, fix, and refactor code
- **Responsibilities:**
  - Implement features from specs
  - Bug fixes from approved RCAs
  - Refactoring for clarity/performance
  - Local testing before review
- **Model default:** Sonnet
- **Tools:** Read, Edit, Write, Grep, Glob, Bash, LSP

#### reviewer
- **Purpose:** Code review, quality, and security checks
- **Responsibilities:**
  - Detect bugs, architectural issues
  - Security/OWASP analysis
  - Performance and scalability review
  - Approve or request revisions
- **Model default:** Opus
- **Tools:** Read, Grep, Glob, Bash, LSP (no write)

#### planner
- **Purpose:** Architecture, design, and planning
- **Responsibilities:**
  - System design and architecture
  - Implementation roadmaps
  - Dependency analysis
  - Risk assessment
- **Model default:** Sonnet
- **Tools:** Read, Write, Edit, Grep, Glob, Bash

### Testing & Quality Agents (2)

#### qa
- **Purpose:** Testing, validation, acceptance criteria
- **Responsibilities:**
  - Test plan creation
  - Manual/automated test design
  - Acceptance criteria validation
  - Regression detection
- **Model default:** Sonnet
- **Tools:** Read, Write, Edit, Grep, Glob, Bash, LSP

#### solutions-architect
- **Purpose:** Feature spec, data flow, API contracts
- **Responsibilities:**
  - Translate requirements to detailed specs
  - API/schema design
  - Data flow diagrams
  - Error handling strategy
- **Model default:** Opus
- **Tools:** Read, Write, Edit, Grep, Glob, Bash

### Planning & Requirements Agents (2)

#### requirements-gatherer
- **Purpose:** Requirements elicitation and documentation
- **Responsibilities:**
  - Gather business/user requirements
  - Create BRD/URD documents
  - Define FR + NFR
  - Acceptance criteria specification
- **Model default:** Sonnet
- **Tools:** Read, Write, Edit, Grep, Glob, Bash

#### devops
- **Purpose:** CI/CD, infrastructure, deployment
- **Responsibilities:**
  - Pipeline configuration
  - Infrastructure setup (Terraform/Docker)
  - Deployment automation
  - Monitoring & alerting
- **Model default:** Sonnet
- **Tools:** Read, Write, Edit, Grep, Glob, Bash

### Specialized & Support Agents (4)

#### researcher
- **Purpose:** Web research, documentation audit
- **Responsibilities:**
  - Technical research on topics
  - Library/framework documentation audit
  - Best-practice discovery
  - Competitive analysis
- **Model default:** Opus
- **Tools:** WebSearch, WebFetch, Read, Write

#### code-reviewer
- **Purpose:** Formal code review (specialized)
- **Responsibilities:**
  - Detailed line-by-line review
  - Architectural evaluation
  - Best-practice enforcement
  - Sign-off on critical changes
- **Model default:** Opus
- **Tools:** Read, Grep, Glob, Bash (no write)

#### explore
- **Purpose:** Fast read-only code search
- **Responsibilities:**
  - Find files by pattern
  - Grep for symbols/keywords
  - Locate definitions/callers
  - Code location discovery
- **Model default:** Haiku
- **Tools:** Read, Grep, Glob (no write)

#### general-purpose
- **Purpose:** Catch-all for unmatched tasks
- **Responsibilities:**
  - Tasks that don't fit other agents
  - Ad-hoc analysis
  - Experimentation
  - Fallback orchestration
- **Model default:** Sonnet
- **Tools:** All (except Artifact)

#### worker
- **Purpose:** Multi-discipline generalist
- **Responsibilities:**
  - Code + review + testing (combined)
  - Small feature end-to-end
  - Cross-cutting concerns
  - When coordination overhead exceeds benefit
- **Model default:** Sonnet
- **Tools:** All (except Artifact)

---

## Skills (9 Documented Here; 12 Total — see [plugins/assist-plugin/CLAUDE.md](../CLAUDE.md) for the full table including `ask`, `bump`, `pr-review`)

### do
**Command:** `/do <task description>`  
**Purpose:** Orchestrate task routing to best agent

**Workflow:**
1. Classify the incoming task (primary intent, scope, output type)
2. Match to agent using registry
3. Query user for model overrides (if needed)
4. Create execution plan with approval
5. Delegate to agent(s) with review loops
6. Synthesize results

**Model:** Orchestrator (Opus), agents per registry
**Effort:** xhigh

**Key features:**
- Multi-agent parallelization
- Model override prompts
- Plan-based execution
- Review gate enforcement

---

### debug
**Command:** `/debug [analyze | fix | review] [description | file:line]`  
**Purpose:** Root cause analysis and iterative fix cycles

**Subcommands:**

| Mode | Action | Output |
|------|--------|--------|
| `analyze` | Investigate bug, gather context | RCA report |
| `fix` | Apply fix (requires approved RCA) | Code changes |
| `review` | Verify fix is correct | Verification report |

**Model:** Sonnet  
**Effort:** high

**Constraints:**
- `fix` requires approved RCA or human-report
- No broad try/catch patches
- Find root cause, don't patch symptoms

---

### commit
**Command:** `/commit`  
**Purpose:** Create conventional commits with git

**Features:**
- Conventional Commits format (feat/fix/refactor/docs/test)
- Scoped commits (scope:subject format)
- Multi-file staging
- Squash/amend support

**Model:** Haiku  
**Effort:** low

---

### branch
**Command:** `/branch [create | switch]`  
**Purpose:** Branch creation and switching

**Features:**
- Create feature/bugfix/release branches
- Naming conventions (feature/*, bugfix/*, release/*)
- Switch with stash support
- Track remote branches

**Model:** Haiku  
**Effort:** low

---

### map-project
**Command:** `/map-project`  
**Purpose:** Discover and document repo structure

**Features:**
- Scan for key directories (src, tests, config)
- Identify stack (language, framework, tools)
- Document module/package structure
- Generate architecture diagram

**Model:** Sonnet  
**Effort:** medium

---

### technical-writing
**Command:** `/technical-writing [docs | readme]`  
**Purpose:** Generate and update documentation

**Subcommands:**
- `docs` — Create user/developer documentation
- `readme` — Generate or update README

**Model:** Sonnet  
**Effort:** medium

---

### gather-requirements
**Command:** `/gather-requirements [elicit | document | review] [topic | file]`  
**Purpose:** Gather and document business, user, and technical requirements

**Subcommands:**

| Mode | Action | Output |
|------|--------|--------|
| `elicit` | Six-phase interactive elicitation with batched questions | Requirements summary |
| `document` | Categorize into BR/UR/FR/NFR, apply IEEE 29148 sentence forms | `BRD-*.md`, `URD-*.md`, `FR-NFR-*.md`, optional JSON |
| `review` | Quality, completeness, consistency, and traceability audit | PASS / NEEDS REVISION report |

**Model:** Sonnet  
**Effort:** high

**Key features:**
- `BR-NNN → UR-NNN → FR-NNN`/`NFR-NNN` traceability chain, cited by specs and code markers
- RFC 2119 binding language (SHALL/MUST/SHOULD/MAY) in every FR and NFR
- Acceptance criteria as GIVEN/WHEN/THEN scenarios, one happy path and one failure path per FR
- Nine-criterion quality checklist plus a banned-words list

**Used by:** requirements-gatherer agent

---

### spec-from-requirements
**Command:** `/spec-from-requirements [create | delta | review] [feature-name | file-path]`  
**Purpose:** Turn requirements into specification files under `specs/`

**Modes:**

| Mode | Action | Output |
|------|--------|--------|
| `create` | Classify the requirement, apply the matching template, write the spec | `specs/spec-[feature].md` |
| `delta` | Record an incremental change without rewriting the file | `## Change Log` section with ADDED/MODIFIED/REMOVED |
| `review` | Completeness, correctness, and coherence audit | CRITICAL / WARNING / SUGGESTION findings |

**Model:** Opus  
**Effort:** high

**Key features:**
- Classify-first: Architecture, API endpoint, Frontend action, Functionality, UI/UX design, General (first match wins, never mix templates)
- Behavior written as `### Requirement:` plus `#### Scenario:` GIVEN/WHEN/THEN blocks with RFC 2119 keywords
- Every spec traces to at least one `BR/UR/FR/NFR-NNN` ID from `gather-requirements`
- OpenAPI 3.1 fragment for API endpoint specs; JSON projection for any spec
- GCP/AWS cloud pattern library and the five cloud-boundary rules
- Pseudo-code gate: agent-suggested blocks keep the spec at Draft until approved

**Used by:** solutions-architect agent

---

### review-md
**Command:** `/review-md <path-to-report.md>`  
**Purpose:** Review markdown reports for factual soundness, consistency, and conciseness

**Modes:**
- Manual — invoked directly on any report file
- Automated — auto-invoked after report-producing skills (`ask`, `debug`, `pr-review`, `technical-writing`, `bump`, `map-project`, `commit`, `branch`, `do`) before the report reaches the user

**Model:** Sonnet  
**Effort:** medium

**Constraints:**
- Read-only on the reviewed file; never edits it
- Produces a separate findings artifact using the three-part structure (what's wrong, why it matters, what to change)

---

## Governance Rules

See [rules/assist-plugin-rule.md](../rules/assist-plugin-rule.md)

**Key gates:**
- **Security:** OWASP review on code changes (top 10 vulnerabilities)
- **Testing:** >70% test coverage for new code
- **Review:** Code reviewer sign-off required before merge

---

## Token Optimization Strategy

See [TOKEN_OPTIMIZATION.md](TOKEN_OPTIMIZATION.md) for detailed rationale.

**Key techniques:**
- Link-based documentation (pointers, not inline)
- Consolidated agent registry (table, no duplication)
- Concise agent descriptions (400 chars max)
- Table-driven data (no prose for static info)
- Reuse: Skills reference agent docs; agents reference model routing

**Result:** ~65% token footprint of original software-development plugin with full feature parity.


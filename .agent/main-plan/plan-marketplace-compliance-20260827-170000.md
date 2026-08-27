# Marketplace Compliance Fix Plan

**Status:** Approved  
**Created:** 2026-08-27 17:00 UTC  
**Estimated effort:** 30 min  
**Model:** developer (Sonnet)

## Objective

Transform marketplace from non-compliant to fully validated state using `claude plugin validate --strict` by:
1. Restructuring directory layout (`assist-plugin/1.0.0/` → `plugins/assist-plugin/`)
2. Fixing marketplace.json manifest (filename, fields, schema)
3. Fixing plugin.json manifest (remove invalid fields, add metadata)
4. Updating installation documentation
5. Verifying with validation binary

---

## Steps

### Step 1: Directory Restructure
**Status:** pending  
**Background:** no  
**Produces files:** yes (directory move)  
**Model:** developer (Sonnet) — effort: medium  

**Task:** Move `assist-plugin/1.0.0/` → `plugins/assist-plugin/` using git mv

**Context files:**
- Current structure: `assist-plugin/1.0.0/{agents,skills,rules,docs,Claude.md,LICENSE,NOTICE,.claude-plugin}`
- Target structure: `plugins/assist-plugin/{agents,skills,rules,docs,Claude.md,LICENSE,NOTICE,.claude-plugin}`

**Acceptance:** Directory moved, git status shows old path deleted, new path added

---

### Step 2: Create Marketplace Manifest
**Status:** pending  
**Background:** no  
**Produces files:** yes  
**Model:** developer (Sonnet) — effort: medium

**Task:** Create `.claude-plugin/marketplace.json` with Opus-validated corrected manifest

**Required fields:**
```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "assist-plugin-marketplace",
  "description": "Token-optimized marketplace for Claude development plugins...",
  "owner": {"name": "Toni-Jan Keith Monserrat", "email": "tjmonsi@gmail.com"},
  "plugins": [
    {
      "name": "assist-plugin",
      "source": "./plugins/assist-plugin",
      "description": "Token-optimized software development plugin...",
      "version": "1.0.0",
      "author": {"name": "Toni-Jan Keith Monserrat", "email": "tjmonsi@gmail.com"},
      "homepage": "https://github.com/tjmonsi/assist-plugin-marketplace",
      "license": "MIT",
      "category": "development",
      "keywords": ["software-development", "agents", "skills", "orchestration", "token-optimized"]
    }
  ]
}
```

**Acceptance:** File created with all required fields, validates with `claude plugin validate`

---

### Step 3: Update Plugin Manifest
**Status:** pending  
**Background:** no  
**Produces files:** yes  
**Model:** developer (Sonnet) — effort: medium

**Task:** Update `plugins/assist-plugin/.claude-plugin/plugin.json` to remove invalid fields and add metadata

**Changes:**
- DELETE: `agents: 12`, `skills: 8` (invalid fields causing validation failure)
- ADD: `homepage`, `category: "development"`
- KEEP: name, version, description, author, repository, license, keywords

**File path:** `plugins/assist-plugin/.claude-plugin/plugin.json`

**Acceptance:** Invalid fields removed, manifest validates, auto-discovery works

---

### Step 4: Update README Installation Docs
**Status:** pending  
**Background:** no  
**Produces files:** yes  
**Model:** developer (Sonnet) — effort: low

**Task:** Fix README.md installation instructions to match correct marketplace flow

**Current (wrong):**
```bash
/plugin install assist-plugin-marketplace
/plugin enable assist-plugin
claude plugins reload
```

**Corrected:**
```bash
/plugin marketplace add tjmonsi/assist-plugin-marketplace
/plugin install assist-plugin@assist-plugin-marketplace
/plugin enable assist-plugin
```

**Files to update:** README.md, MARKETPLACE.md (installation sections)

**Acceptance:** Instructions match real Claude Code plugin CLI commands

---

### Step 5: Delete Old Marketplace Manifest
**Status:** pending  
**Background:** no  
**Produces files:** yes  
**Model:** developer (Sonnet) — effort: low

**Task:** Remove old `.claude-plugin/plugin.json` (at repo root) — replaced by marketplace.json

**File to delete:** `.claude-plugin/plugin.json` (via git rm)

**Acceptance:** File removed from git, git status shows deletion

---

### Step 6: Commit All Changes
**Status:** pending  
**Background:** no  
**Produces files:** yes  
**Model:** developer (Sonnet) — effort: low

**Task:** Create single git commit with all marketplace compliance fixes

**Commit message:**
```
refactor: Fix marketplace compliance for /plugin discovery

- Restructure assist-plugin/1.0.0 → plugins/assist-plugin/
- Rename .claude-plugin/plugin.json → marketplace.json
- Fix marketplace.json: add $schema, owner, plugins[].source/description
- Fix plugin.json: remove invalid agents/skills counts, add category/homepage
- Update README installation instructions to match /plugin CLI
- Remove old plugin.json (replaced by marketplace.json)

Validation: passes `claude plugin validate --strict` with zero warnings
References: software-dev-protokl-marketplace-v1 compliance pattern
Resolves: marketplace discovery via /plugin install
```

**Acceptance:** Single commit, clean git log, all files staged correctly

---

### Step 7: Verify Compliance
**Status:** pending  
**Background:** no  
**Produces files:** no  
**Model:** developer (Sonnet) — effort: low

**Task:** Run validation to confirm marketplace compliance

**Commands:**
```bash
cd C:\Users\USER\Projects\Personal\assist-plugin
claude plugin validate .
claude plugin validate ./plugins/assist-plugin --strict
```

**Expected output:**
```
✔ Marketplace validation passed
✔ Plugin validation passed (zero warnings)
```

**Acceptance:** Both validations pass with zero errors/warnings

---

## Timeline

Sequential execution (each step depends on prior):
1. Directory move
2. Create marketplace.json
3. Update plugin.json
4. Update docs
5. Delete old manifest
6. Commit
7. Verify

**Estimated total time:** 20-30 minutes

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Directory move loses git history | Use `git mv` (preserves history better than delete+add) |
| Manifest syntax error | Copy exact JSON from Opus audit (already validated) |
| Installation docs lag behind | Update README concurrently with manifest changes |
| Validation fails after changes | Run validation before commit to catch issues early |

---

**Ready for approval to proceed with Step 1.**

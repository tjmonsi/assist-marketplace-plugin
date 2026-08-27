# PR Detection & Platform Strategy

Auto-detection strategy for identifying GitHub vs. Bitbucket repositories.

## Git Remote Patterns

### GitHub

**HTTPS:**
```
https://github.com/USER/REPO.git
https://github.com/USER/REPO
```

**SSH:**
```
git@github.com:USER/REPO.git
git@github.com:USER/REPO
```

**GitHub Enterprise:**
```
https://github.company.com/USER/REPO.git
git@github.company.com:USER/REPO.git
```

**Detection:** URL contains `github.com` or `github.` prefix

---

### Bitbucket Cloud

**HTTPS:**
```
https://bitbucket.org/USER/REPO.git
https://bitbucket.org/USER/REPO
```

**SSH:**
```
git@bitbucket.org:USER/REPO.git
```

**Detection:** URL contains `bitbucket.org`

---

### Bitbucket Server / Data Center

**HTTPS:**
```
https://bitbucket.company.com/scm/PROJECT/REPO.git
https://bitbucket.internal/bitbucket/scm/PROJECT/REPO.git
```

**SSH:**
```
ssh://git@bitbucket.company.com:7999/PROJECT/REPO.git
git@bitbucket.company.com:7999/PROJECT/REPO.git
```

**Detection:** URL contains `/scm/` path or custom domain with `bitbucket`

---

## Detection Algorithm

```bash
# 1. Get git remote URL
git_remote=$(git remote get-url origin)

# 2. Check patterns
if [[ $git_remote == *"github.com"* ]] || [[ $git_remote == *"github."* ]]; then
  platform="github"
  cli="gh"
  
elif [[ $git_remote == *"bitbucket.org"* ]]; then
  platform="bitbucket_cloud"
  cli="bkt"
  
elif [[ $git_remote == *"/scm/"* ]] || [[ $git_remote == *"bitbucket"* ]]; then
  platform="bitbucket_server"
  cli="bkt"  # or custom SSH
  
else
  platform="unknown"
  error "Cannot detect platform from remote: $git_remote"
fi
```

## CLI Tools Required

### GitHub (`gh`)

Install: `brew install gh` or `winget install GitHub.cli`

Verify: `gh --version`

Authentication: `gh auth login`

### Bitbucket (`bkt`)

**Bitbucket Cloud:**
- Install: `pip install bitbucket-cli` or from source
- Verify: `bkt --version`
- Auth: `bkt auth` or via OAuth

**Bitbucket Server/DC:**
- May require custom scripts or Bitbucket REST API
- Alternative: Use `curl` with `--user` for authentication
- Rest API docs: `https://bitbucket.company.com/rest/api/1.0/`

## PR Identification

### Three Methods

#### 1. Explicit PR Number

```bash
/pr-review 123
→ Fetches PR #123 (or pull request 123 for Bitbucket)
```

#### 2. Current Branch (Auto-detect)

```bash
/pr-review
→ Gets current branch: git rev-parse --abbrev-ref HEAD
→ Finds PR associated with that branch
→ GitHub: gh pr view --head BRANCH
→ Bitbucket: bkt pr list --state OPEN --query "fromRef.repository.name == REPO AND fromRef.displayId == BRANCH"
```

#### 3. Explicit Branch Name

```bash
/pr-review feature/auth
→ Finds PR for branch: feature/auth
→ Searches open PRs matching that branch
```

## URL Parsing

### GitHub

**PR URL:** `https://github.com/user/repo/pull/123`

Parse:
```bash
owner=$(echo $url | cut -d'/' -f4)
repo=$(echo $url | cut -d'/' -f5)
pr_number=$(echo $url | cut -d'/' -f7)
```

### Bitbucket Cloud

**PR URL:** `https://bitbucket.org/user/repo/pull-requests/456`

Parse:
```bash
owner=$(echo $url | cut -d'/' -f4)
repo=$(echo $url | cut -d'/' -f5)
pr_id=$(echo $url | cut -d'/' -f7)
```

### Bitbucket Server

**PR URL:** `https://bitbucket.company.com/projects/PROJECT/repos/repo/pull-requests/789`

Parse:
```bash
project=$(echo $url | grep -oP '(?<=projects/)[^/]*')
repo=$(echo $url | grep -oP '(?<=repos/)[^/]*')
pr_id=$(echo $url | grep -oP '(?<=pull-requests/)[^/]*')
```

## Fallback Logic

If detection fails:

1. **Check environment variables:**
   ```bash
   GITHUB_SERVER_URL → GitHub
   BITBUCKET_URL → Bitbucket
   ```

2. **Prompt user:**
   ```
   Cannot auto-detect platform.
   
   Is this a GitHub or Bitbucket repository?
   (github | bitbucket)
   ```

3. **Manual remote specification:**
   ```bash
   /pr-review 123 --github
   /pr-review 123 --bitbucket
   ```

## Authentication Handling

### GitHub

```bash
# Check if authenticated
gh auth status

# If not, ask user to run:
gh auth login
  - Authenticate with GitHub account
  - Choose: HTTPS or SSH
```

### Bitbucket

```bash
# Bitbucket Cloud
bkt auth

# Bitbucket Server (via SSH key)
SSH_KEY_PATH=~/.ssh/id_rsa
git clone git@bitbucket.company.com:PROJECT/repo.git

# Or via REST API with basic auth
curl -u username:password https://bitbucket.company.com/rest/api/1.0/...
```

## Edge Cases

### Multiple Remotes

If repo has multiple remotes (e.g., `origin` and `upstream`):

```bash
# Prefer 'origin'
git_remote=$(git remote get-url origin)

# Fallback to 'upstream' if origin is local/fork
if [[ $git_remote == *"file://"* ]] || [[ $git_remote == *"/tmp/"* ]]; then
  git_remote=$(git remote get-url upstream)
fi
```

### Fork Workflow

If reviewing on a fork:
- Detect platform from fork remote (`origin`)
- Note: Original repo is different from fork
- For Bitbucket: Projects/repos are per-instance

### Behind Corporate Proxy

If behind proxy:
```bash
# GitHub Enterprise
gh config set api_hostname github.company.com

# Bitbucket Server
# May require VPN or SSH tunnel
ssh -L 7990:bitbucket.internal:7990 jumphost.company.com
```

## Test Detection

To verify platform detection works:

```bash
/pr-review --detect-only
→ Outputs: "Platform: GitHub (gh CLI)"
→ Outputs: "Remote: https://github.com/user/repo.git"
→ Outputs: "Available: gh ✓"
```

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
https://github.example.com/USER/REPO.git
git@github.example.com:USER/REPO.git
```

**Detection:** URL contains `github.com` or `github.` prefix

---

### Bitbucket Cloud

**HTTPS:**
```
https://bitbucket.org/<ws>/<repo>.git
https://bitbucket.org/<ws>/<repo>
```

**SSH:**
```
git@bitbucket.org:<ws>/<repo>.git
ssh://git@bitbucket.org/<ws>/<repo>.git
```

**Detection:** exactly two path segments after the host `bitbucket.org`. A `bkt` context of kind `cloud` must also match (see Detection Algorithm).

---

### Bitbucket Data Center

**HTTPS** (`<context-path>` is optional):
```
https://bitbucket.example.com/scm/PROJECT/REPO.git
https://bitbucket.example.net/bitbucket/scm/PROJECT/REPO.git
```

**SSH** (7999 is the default SSH port):
```
ssh://git@bitbucket.example.com:7999/PROJECT/REPO.git
git@bitbucket.example.com:PROJECT/REPO.git
```

The generic forms are `https://<host>[:<port>][/<context-path>]/scm/<KEY>/<repo>.git`, `ssh://git@<host>[:<port>]/<KEY>/<repo>.git`, and the scp-like `git@<host>:<KEY>/<repo>.git`. The scp-like form carries no port, because its colon cannot. A spelling such as `git@<host>:7999/<KEY>/<repo>.git` parses by the same rule: `7999` is a path segment, not a port, and the last two segments still give the key and the slug.

**Parsing:**
- Take the project key and the repository slug from the last two path segments, and remove a trailing `.git`.
- Compare the host without its port and without regard to case.
- The workspace, key, and slug each match `^[A-Za-z0-9._-]+$`, or the skill stops before any `bkt` call. A personal repository (`~user`) fails the pattern and is not supported.

**Detection:** a single `bkt` context whose base-URL hostname equals the remote host decides first, whatever the host name or URL form. Without a match, a `/scm/` path or a host name that contains `bitbucket` marks a Bitbucket remote with no context (see Detection Algorithm).

---

## Detection Algorithm

Read the `origin` remote with `git remote get-url origin`, remove any `user:password@` or `token@` part, and apply these rules in order:

1. **GitHub.** The URL contains `github.com` or `github.` (GitHub Enterprise included). Platform `github`, CLI `gh`.
2. **A matching `bkt` context.** For any other remote, run pin steps 1 to 3 of [SKILL.md](../SKILL.md) first: the identity check, the three `BKT_*` presence tests, then the filtered `bkt auth status --json` contexts command. `bkt` is bitbucket-cli and exactly one context in that output matches the remote's hostname, ports ignored. The remote is a Bitbucket remote whatever its host name or URL form. Platform `bitbucket_cloud` when the context kind is `cloud`, else `bitbucket_server` (Data Center). CLI `bkt`.
3. **A Bitbucket remote with no matching context.** The host is `bitbucket.org`, the HTTPS path holds `/scm/`, or the host contains `bitbucket`. The skill stops with the setup lines below, or reports `bkt` missing.
4. **Anything else** goes to the Fallback Logic below.

```bash
git_remote=$(git remote get-url origin)   # strip user:password@ or token@ first

if [[ $git_remote == *"github.com"* ]] || [[ $git_remote == *"github."* ]]; then
  platform="github"; cli="gh"
# rule 2: after pin steps 1 to 3 (identity, presence tests, contexts), bkt is bitbucket-cli
#   and exactly one context matches the remote hostname
#   -> platform="bitbucket_cloud" or "bitbucket_server" by context kind; cli="bkt"
# rule 3: host is bitbucket.org, path holds /scm/, or host contains "bitbucket"
#   -> stop: setup lines, or "bkt missing"
else
  platform="unknown"                      # Fallback Logic
fi
```

Rule 2 runs pin steps 1 to 3 of [SKILL.md](../SKILL.md) (identity check, the three `BKT_*` presence tests, the filtered contexts command) and matches on that output. On Cloud the link check (pin step 4) follows once the PR number is known.

## CLI Tools Required

### GitHub (`gh`)

Install: `brew install gh` or `winget install GitHub.cli`

Verify: `gh --version`

Authentication: `gh auth login`

### Bitbucket (`bkt`)

The plugin uses bitbucket-cli ([avivsinai/bitbucket-cli](https://github.com/avivsinai/bitbucket-cli)) v0.34.0 for Bitbucket Cloud and Data Center. Another tool, dimo414/bkt, shares the binary name.

**Install:**
- `brew install avivsinai/tap/bitbucket-cli`
- `brew install bitbucket-cli`
- `winget install AvivSinai.Bitbucket-CLI`
- `go install github.com/avivsinai/bitbucket-cli/cmd/bkt@latest`

**Identity check:** `bkt --version` must exit 0, and its first line must match `^bkt version v?[0-9]+\.[0-9]+\.[0-9]+`. Any other output (dimo414/bkt prints `bkt 0.8.2`) counts as bitbucket-cli missing: show the install lines and run no other `bkt` command.

**Sign in and create a context** (login creates no context, and PR commands fail without one):
```bash
# Bitbucket Cloud
bkt auth login https://bitbucket.org --kind cloud --web        # or --web-token
bkt context create <name> --host api.bitbucket.org --workspace <ws> --set-active

# Bitbucket Data Center
bkt auth login https://<host>
bkt context create <name> --host <host> --project <KEY> --set-active
```

`bkt auth status` exits 0 without an HTTP call, so it proves nothing about the token. A failed first `bkt pr view` is the sign that the token or context is wrong.

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
→ GitHub: gh pr list --head '<branch>' --state open --json number (only after the branch pattern check below)
→ Bitbucket Cloud: bkt pr list --context '<ctx>' --workspace '<ws>' --repo '<slug>' --state OPEN --limit 0 --json --jq '[.pull_requests[]? | select(.source.branch.name == "<branch>") | .id]'
→ Bitbucket Data Center: the same with --project '<KEY>' and select(.fromRef.displayId == "<branch>")
→ The branch name is used only when it matches ^[A-Za-z0-9._/-]+$; [] means no open PR has that branch
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

**PR URL:** `https://bitbucket.example.com/projects/PROJECT/repos/repo/pull-requests/789`

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
# Check the tool is bitbucket-cli (first line: bkt version vX.Y.Z)
bkt --version

# Bitbucket Cloud
bkt auth login https://bitbucket.org --kind cloud --web
bkt context create <name> --host api.bitbucket.org --workspace <ws> --set-active

# Bitbucket Data Center
bkt auth login https://<host>
bkt context create <name> --host <host> --project <KEY> --set-active
```

If no context matches the remote, stop before any `bkt pr` call and show these lines. `bkt auth status` lists hosts and contexts but does not check the token.

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
gh config set api_hostname github.example.com

# Bitbucket Server
# May require VPN or SSH tunnel
ssh -L 7990:bitbucket.example.net:7990 jumphost.example.com
```

## Test Detection

To verify platform detection works:

```bash
/pr-review --detect-only
→ Outputs: "Platform: GitHub (gh CLI)"
→ Outputs: "Remote: https://github.com/user/repo.git"
→ Outputs: "Available: gh ✓"
```

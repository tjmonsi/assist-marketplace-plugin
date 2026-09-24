# Python 3.12+ Reference

## Contents
- Mandatory Toolchain
- UV Workflow
- Code Style Rules
- Type System Rules
- Prohibited Patterns
- Required Configuration Files
- Project Structure

## Mandatory Toolchain

| Tool | Purpose | Prohibited alternatives |
|------|---------|------------------------|
| Python 3.12 | Runtime | < 3.11 |
| `ruff` | Lint + format | black, isort, flake8, pylint |
| `uv` | Project management, dependencies, execution, packaging — replaces ALL of the alternatives | `python` (for execution), `pyenv`, `pip`, `pip-tools`, `venv`, `poetry`, `pipx` |
| Pydantic v2 | Data validation | dataclasses for validation, Pydantic v1 |
| `mypy` or `pyright` | Static type checking | Skipping type checks in CI |
| `pytest` | Testing | `unittest` for new projects |

Gate: `uv run ruff check . && uv run ruff format --check .` must pass before commit.

## UV Workflow

**Project initialization:**
```bash
uv init my-project                    # Creates pyproject.toml, .python-version, main.py
uv init --package my-project          # Packaged app with src/ layout
uv init --lib my-lib                  # Library for PyPI distribution
uv init --python 3.12 my-project     # Specify Python version
```

**Dependency management:**
```bash
uv add requests                       # Add runtime dependency
uv add --dev pytest ruff mypy         # Add dev dependencies
uv add "requests==2.31.0"            # Pin exact version
uv remove requests                    # Remove dependency
uv lock                               # Resolve and lock dependencies
uv sync                               # Install from lockfile
uv sync --no-dev                      # Production install (no dev deps)
```

**Running programs (replaces `python`):**
```bash
uv run main.py                        # Run script (auto-syncs venv)
uv run pytest                         # Run test suite
uv run ruff check .                   # Run linter
uv run mypy .                         # Run type checker
uv run python -c "..."               # Run inline Python
uv run --with rich script.py          # Run with temporary extra dep
```

**Tool execution (replaces `pipx`):**
```bash
uvx ruff check .                      # Ephemeral tool run (no install)
uv tool install ruff                  # Persistent tool install
```

**Key rules:**
- Never activate the venv manually — always use `uv run`
- Never use `uv pip install` for project dependencies — use `uv add`
- `uv.lock` and `.python-version` must be committed to version control
- `uv run pytest` not `uvx pytest` — tests need project access
- UV auto-downloads Python versions — no pyenv needed

## Code Style Rules

- Line length: set explicitly in `pyproject.toml` (100 or 88, consistent project-wide)
- Naming: `snake_case` for functions/variables, `PascalCase` for classes, `UPPER_SNAKE_CASE` for constants
- Docstrings on all public modules, classes, and functions (Google or NumPy style; enforced by `ruff` `D` rules if enabled)
- f-strings for interpolation; never `%` formatting or `.format()` on new code
- Import order enforced by `ruff` (`I` rules): stdlib, third-party, local — no manual sorting
- One statement per line; no semicolon-separated statements
- Prefer composition and small pure functions over deep inheritance hierarchies
- Use `pathlib.Path` for filesystem paths, never raw string concatenation

## Type System Rules

- `X | None` not `Optional[X]`; `list[str]` not `List[str]`; `dict[str, int]` not `Dict[str, int]`
- Use `type` statement for aliases (3.12+): `type UserId = int`
- All functions, methods, and variables carry explicit type annotations
- Use `Protocol` for structural typing instead of ABCs when only method signatures matter
- Use `TypedDict` for dict-shaped data that isn't a Pydantic model
- Use `@overload` for functions with multiple valid signatures
- Avoid `Any`; if unavoidable, isolate it behind a narrow boundary and narrow immediately
- Generics: use PEP 695 syntax (3.12+) — `def first[T](items: list[T]) -> T`
- Run `mypy --strict` or `pyright --strict` in CI; do not merge with type errors suppressed

## Prohibited Patterns

| Pattern | Fix |
|---------|-----|
| Mutable default args `def f(x=[])` | Use `None` sentinel |
| Bare `except:` | `except SpecificError:` |
| `from typing import List, Dict, Optional` | Use built-in generics |
| `print()` for logging | Use `logging` module |
| Catching `Exception` without re-raise or log | Log and re-raise |
| `python script.py` | Use `uv run script.py` |
| `pip install X` | Use `uv add X` |
| `python -m venv .venv` | UV manages venvs automatically |
| `source .venv/bin/activate` | Not needed with `uv run` |
| `pyenv install 3.12` | Use `uv python install 3.12` |
| `pipx run tool` | Use `uvx tool` |

## Required Configuration Files

| File | Purpose | Committed? |
|------|---------|------------|
| `pyproject.toml` | Project metadata, dependencies, `[tool.ruff]`, `[tool.mypy]`, `[tool.pytest.ini_options]` | Yes |
| `uv.lock` | Locked dependency graph for reproducible installs | Yes |
| `.python-version` | Pins the Python version `uv` provisions | Yes |
| `.gitignore` | Exclude `.venv/`, `__pycache__/`, `*.pyc`, `.ruff_cache/`, `.mypy_cache/` | Yes |

Minimum `pyproject.toml` sections:

```toml
[project]
name = "my-project"
requires-python = ">=3.12"

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B"]

[tool.mypy]
strict = true
python_version = "3.12"

[tool.pytest.ini_options]
testpaths = ["tests"]
```

## Project Structure

```
src/
  <package_name>/
    __init__.py
    main.py              # Entry point
    config.py            # Settings/env loading
    core/                # Domain logic, no I/O
    utils/               # Shared helpers
tests/
  __init__.py
  conftest.py            # Shared fixtures
  test_*.py
pyproject.toml           # ruff, mypy, uv, project config
uv.lock                  # committed — reproducible installs
.python-version          # committed — pins Python version for uv
README.md
```

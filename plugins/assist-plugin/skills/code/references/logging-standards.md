# Logging Standards

All code must use structured logging only. Unstructured logging (print, console.log, etc.) is prohibited in production code.

## Log Levels

Use the standard taxonomy:

| Level | When to use | Example |
|---|---|---|
| `debug` | Development and troubleshooting; low-value in production | `Entering function X`, variable values during flow |
| `info` | Significant state changes and normal operation progress | User action completed, request received, job started |
| `warn` | Recoverable errors and unexpected but handled conditions | Retry attempt, fallback activated, deprecated API used |
| `error` | Failures requiring attention but not process-fatal | Request failed, operation timed out, validation failed |
| `fatal` | Unrecoverable error; process must terminate | System initialization failed, critical resource unavailable |

Never log at `error` or `fatal` level for conditions the code is designed to handle. Use `warn` for retries; `error` for the final failure after exhausting retries.

## Structured Logging Tools

Every language MUST use its native structured logger, never `print()` / `console.log()`:

| Language | Tool | Package/Import |
|---|---|---|
| Python | `logging` + JSON formatter | `import logging` (stdlib) |
| TypeScript/Node.js | Pino | `import pino from 'pino'` |
| JavaScript | Pino | `const pino = require('pino')` |
| Go | `slog` | `import "log/slog"` (Go 1.21+) |
| Rust | `tracing` | `use tracing::{info, warn, error}` |
| Kotlin | Timber (Android) or SLF4J (backend) | `Timber.d()` or `org.slf4j.Logger` |
| C++ | spdlog | `#include <spdlog/spdlog.h>` |

## Output Format

All structured logs MUST be JSON. Example:

```json
{"timestamp":"2025-09-24T10:30:45.123Z","level":"info","message":"User login successful","userId":12345,"sessionId":"sess_abc123","duration_ms":145}
```

Fields:
- `timestamp` — ISO 8601 format, UTC timezone
- `level` — debug, info, warn, error, fatal
- `message` — Human-readable, 1-2 sentences
- Custom fields — Add context but keep the payload minimal

## Never Log

**Absolute prohibition — never log these values, even hashed or redacted:**

- Passwords, API keys, OAuth tokens, JWTs
- Full credit card numbers (PAN), full SSN, full passport numbers
- Full email addresses or phone numbers (unless hashed via a one-way function like SHA256)
- Private keys, certificate contents
- Encryption keys or salts
- Session cookies or auth headers (unless explicitly redacted)

## Mask Before Logging

When logging user identifiers or sensitive data that cannot be avoided:

| Data | Mask Pattern | Example |
|---|---|---|
| Credit card (PAN) | Last 4 digits only | `****-****-****-4242` |
| Email address | User ID + domain | `user_12345@example.com` → `uid:12345` |
| Phone number | Last 4 digits only | `+1-***-***-1234` |
| Account number | Last 4 digits only | `****3456` |
| User identifier | Hash (SHA256) + first 8 chars | `user_abc123def456` → `u_abc123de` |
| API token | First 8 + last 4 | `sk_live_abc12345...xyz9876` → `sk_live_abc1...9876` |

Examples:

**Good:**
```json
{"level":"info","message":"User login","userId":"uid_abc123","maskedEmail":"uid_456@example.com","lastFourCard":"4242"}
```

**Bad:**
```json
{"level":"info","message":"User login","email":"user@example.com","creditCard":"4111111111111111","password":"hunter2"}
```

## Minimum Necessary Exposure

Log only what is needed to understand the operation or diagnose the problem:

- **Log IDs and counts**, not full objects
- **Log operation type and result**, not request/response bodies
- **Log error type and a short context**, not the entire stack trace in the message (include in a `stack` field if needed)

Example:

**Good:**
```json
{"level":"error","message":"User creation failed","userId":"uid_abc","reason":"Email already exists","errorType":"DuplicateKeyError","stack":"...full stack trace..."}
```

**Bad:**
```json
{"level":"error","message":"Error creating user with email user@example.com password hunter2","body":"{\"email\":\"user@example.com\",\"password\":\"hunter2\",\"age\":32,...}","response":"{\n  \"error\": \"...\"\n}"}
```

## Per-Language Configuration

### Python (logging + JSON)

```python
import logging
import json

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S.%fZ")[:-4] + "Z",
            "level": record.levelname.lower(),
            "message": record.getMessage(),
        }
        if record.exc_info:
            log_obj["stack"] = self.formatException(record.exc_info)
        return json.dumps(log_obj)

handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger = logging.getLogger(__name__)
logger.addHandler(handler)
```

### TypeScript/Node.js (Pino)

```typescript
import pino from 'pino'
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: { target: 'pino-pretty' } // in dev; remove in production
})

logger.info({ userId: user.id }, 'User login successful')
logger.error({ error: err.message, stack: err.stack }, 'Request failed')
```

### Go (slog)

```go
import "log/slog"

logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
logger.InfoContext(ctx, "User login", "userId", user.ID, "duration", elapsed)
logger.ErrorContext(ctx, "Request failed", "error", err, "type", fmt.Sprintf("%T", err))
```

### Rust (tracing + tracing-subscriber)

```rust
use tracing::{info, error, warn, debug};
use tracing_subscriber::fmt::format::FmtSpan;

tracing_subscriber::fmt()
    .json()
    .with_span_list(true)
    .with_span_events(FmtSpan::FULL)
    .init();

info!(user_id = %user.id, "User login successful");
error!(error = ?err, "Request failed");
```

### Kotlin (Timber for Android, SLF4J for backend)

**Android:**
```kotlin
import timber.log.Timber

Timber.d("Debug message")
Timber.i("Info message with userId: %d", userId)
Timber.e(exception, "Error message")
```

With JSON formatting, use a custom Tree:
```kotlin
class JsonTree : Timber.Tree() {
    override fun log(priority: Int, tag: String?, message: String, t: Throwable?) {
        val logObj = mapOf(
            "timestamp" to System.currentTimeMillis(),
            "level" to logLevelName(priority),
            "message" to message,
            "tag" to tag
        )
        if (t != null) logObj["stack"] = Log.getStackTraceString(t)
        println(Json.encodeToString(logObj))
    }
}
Timber.plant(JsonTree())
```

**Backend:**
```kotlin
import org.slf4j.LoggerFactory

val logger = LoggerFactory.getLogger(MyClass::class.java)
logger.info("User login successful: userId={}", userId)
logger.error("Request failed", exception)
```

### C++ (spdlog)

```cpp
#include <spdlog/spdlog.h>
#include <spdlog/sinks/stdout_sinks.h>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

auto sink = std::make_shared<spdlog::sinks::stdout_sink_mt>();
auto logger = std::make_shared<spdlog::logger>("json", sink);
logger->set_pattern(""); // JSON pattern only

// Manual JSON logging:
json log_obj = {
    {"timestamp", "2025-09-24T10:30:45Z"},
    {"level", "info"},
    {"message", "User login successful"},
    {"userId", user_id}
};
logger->info(log_obj.dump());
```

## Rules

- Never use `print()`, `console.log()`, `println()`, `printf()`, or `echo` in production code
- Every log statement includes a human-readable `message` field
- Log custom fields as key-value pairs, not embedded in the message string
- In error logs, include `errorType` (exception/error class name) and optionally `stack` (full trace)
- In high-frequency operations, use `debug` level; in production, set log level to `info` or higher
- Rotations and retention are configured at infrastructure level (Docker/Kubernetes/cloud provider), not in application code

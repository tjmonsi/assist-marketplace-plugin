# Error Handling Standards

## Boundary Doctrine

**Wrap every uncontrolled boundary. Do not wrap pure calculations over validated data.**

### Controlled Boundaries (No wrapping needed)

- Pure calculations over already-validated in-memory data
- Internal function calls within a module
- Calls to code you wrote and control
- Calls that explicitly document they throw/return no errors

### Uncontrolled Boundaries (Always wrap)

- Network calls (HTTP, gRPC, database queries, external APIs)
- File I/O (read, write, delete, directory operations)
- Parsing untrusted input (JSON, XML, user form input, query strings)
- Third-party library calls (unless they document they are infallible)
- Deserialization (JSON → struct, protobuf → message)
- Thread/async/process boundaries (spawning, joining, receiving from channels)
- System calls (subprocess, process spawning, environment access)

### Wrapping Pattern

At each boundary:

1. **Catch** the error
2. **Log** error type, message, stack trace, and minimal context
3. **Classify** as recoverable, operation-fatal, or must-propagate
4. **Act:** retry (if recoverable), fail this operation but keep the process alive, or propagate upward

Example (all languages follow this shape):

```
try:
    result = call_external_api()
    return result
catch SpecificError as e:
    log.error("API call failed", error=type(e).__name__, message=str(e), stack=traceback.format_exc(), endpoint=url)
    if e.is_transient():
        return retry_with_backoff()  # Recoverable
    else:
        raise OperationError("Could not fetch data") from e  # Operation-fatal, propagate
```

## Error Classification

| Category | When | Action | Example |
|---|---|---|---|
| **Recoverable** | Error is transient or can be retried safely | Retry with backoff, use fallback, or skip this unit of work | Network timeout, rate limit, temporary service unavailable |
| **Operation-fatal** | Error is scoped to one request/job; rest of the system continues | Fail this request, log details, keep the process alive | Invalid user input, missing required field, authentication failed |
| **Must-propagate** | Error indicates a system-level issue that cannot continue | Log and propagate upward or shut down gracefully | Database connection lost, out of memory, permission denied on critical file |

## Process-Level Handlers

Every application must have a last-resort error handler so a single bad input or edge case cannot crash the entire process.

### Node.js

```typescript
process.on('uncaughtException', (error: Error) => {
  logger.fatal({
    message: 'Uncaught exception',
    errorType: error.name,
    errorMessage: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  })
  // Perform critical cleanup (flush logs, close DB) here
  process.exit(1)  // Exit gracefully after cleanup
})

process.on('unhandledRejection', (reason: unknown) => {
  logger.fatal({
    message: 'Unhandled promise rejection',
    reason: String(reason),
    timestamp: new Date().toISOString(),
  })
  process.exit(1)
})
```

### Python

```python
import sys
import traceback
import logging

logger = logging.getLogger(__name__)

def exception_hook(type, value, tb):
    logger.critical(
        "Uncaught exception",
        extra={
            "error_type": type.__name__,
            "error_message": str(value),
            "stack": traceback.format_exc(),
        }
    )
    # Perform critical cleanup here
    sys.exit(1)

sys.excepthook = exception_hook
```

### Go

Every goroutine should recover from panics:

```go
func safeGoroutine(fn func()) {
    go func() {
        defer func() {
            if r := recover(); r != nil {
                logger.Error("goroutine panicked",
                    slog.String("panic", fmt.Sprintf("%v", r)),
                    slog.String("stack", string(debug.Stack())),
                )
                // Log full breadcrumbs for later debugging
            }
        }()
        fn()
    }()
}
```

Also implement error handling at request boundaries:

```go
func middleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if err := recover(); err != nil {
                logger.Error("request panicked", slog.String("error", fmt.Sprintf("%v", err)))
                http.Error(w, "Internal server error", http.StatusInternalServerError)
            }
        }()
        next.ServeHTTP(w, r)
    })
}
```

### Rust

Use `catch_unwind` at thread/FFI boundaries:

```rust
use std::panic::catch_unwind;
use std::panic::AssertUnwindSafe;

fn safe_thread_spawn<F>(f: F) 
where
    F: FnOnce() + Send + 'static,
{
    std::thread::spawn(move || {
        if let Err(panic) = catch_unwind(AssertUnwindSafe(f)) {
            eprintln!("Thread panicked: {:?}", panic);
            // Log full context
        }
    })
}
```

For async code, use a custom panic hook:

```rust
std::panic::set_hook(Box::new(|panic_info| {
    tracing::error!(?panic_info, "process panicked");
    // Perform cleanup
    std::process::exit(1);
}));
```

### C++

Set a custom terminate handler:

```cpp
#include <exception>
#include <iostream>
#include <spdlog/spdlog.h>

void handle_terminate() {
    spdlog::critical("std::terminate called");
    try {
        std::rethrow_exception(std::current_exception());
    } catch (const std::exception& e) {
        spdlog::critical("Exception type: {}, message: {}", typeid(e).name(), e.what());
    } catch (...) {
        spdlog::critical("Unknown exception");
    }
    std::abort();
}

int main() {
    std::set_terminate(handle_terminate);
    // Application code
    return 0;
}
```

Use `noexcept` boundaries wisely:

```cpp
// Indicates this function must not throw
void critical_cleanup() noexcept {
    try {
        // Cleanup code
    } catch (...) {
        spdlog::critical("Cleanup threw an exception");
        // Cannot rethrow here
    }
}
```

### Kotlin

Android apps should use an uncaught exception handler:

```kotlin
Thread.setDefaultUncaughtExceptionHandler { thread, exception ->
    Timber.e(exception, "Uncaught exception in thread ${thread.name}")
    // Log full breadcrumbs
    // Optionally restart the app or show an error dialog
}
```

For coroutines, use a `CoroutineExceptionHandler`:

```kotlin
val exceptionHandler = CoroutineExceptionHandler { _, exception ->
    Timber.e(exception, "Coroutine failed")
}

viewModelScope.launch(exceptionHandler) {
    // Coroutine code
}
```

## Logging in Error Handlers

Every error handler must log:

1. **Error type** — the exception/error class name
2. **Error message** — the exception message
3. **Stack trace** — full breadcrumbs
4. **Context** — minimal non-sensitive information (operation ID, user ID if safe, endpoint, etc.)
5. **Timestamp** — when the error occurred

Example across languages:

```python
try:
    response = requests.get(url, timeout=5)
except requests.RequestException as e:
    logger.error(
        "HTTP request failed",
        extra={
            "error_type": type(e).__name__,
            "error_message": str(e),
            "stack": traceback.format_exc(),
            "url": url,
            "operation": "fetch_user_data",
        }
    )
    raise OperationError(f"Failed to fetch data from {url}") from e
```

```typescript
try {
    const response = await fetch(url)
} catch (error: unknown) {
    logger.error({
        message: 'HTTP request failed',
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        url,
        operation: 'fetch_user_data',
    })
    throw new OperationError(`Failed to fetch data from ${url}`)
}
```

## Exception Specifications (C++ and Languages with Checked Exceptions)

In C++, declare `noexcept` for functions that must not throw:

```cpp
void cleanup() noexcept { /* ... */ }
void critical_section() { /* can throw */ }
```

In languages with checked exceptions (Java, Kotlin), document thrown exceptions:

```kotlin
@Throws(IOException::class, NetworkException::class)
suspend fun fetchData(url: String): Data { ... }
```

## Rules

1. Never silently swallow errors — always log
2. Never use bare `except:` or `catch (...)` without logging
3. Do not re-throw without adding context (use `raise ... from e`, `throw new ... from e`, etc.)
4. Do not assume network/file/parse errors are temporary — classify based on error type
5. Every process-level handler must log full details (timestamp, error type, stack, context)
6. Do not log sensitive data in error messages (see [logging-standards.md](logging-standards.md))
7. Keep the process alive whenever the error is scoped to one request/job; only exit on system-level failures

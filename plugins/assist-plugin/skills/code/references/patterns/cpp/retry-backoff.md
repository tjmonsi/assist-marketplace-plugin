# Retry with Exponential Backoff + Jitter — C++

Resilient outbound call helper using `std::function` and `std::this_thread`.
See [../../languages/cpp.md](../../languages/cpp.md) and
[../../error-handling-standards.md](../../error-handling-standards.md).

## Pattern

```cpp
#include <algorithm>
#include <chrono>
#include <functional>
#include <optional>
#include <random>
#include <stdexcept>
#include <thread>

struct RetryOptions {
    int max_attempts = 5;
    std::chrono::milliseconds base_delay{500};
    std::chrono::milliseconds max_delay{8000};
};

template <typename T>
T retry_with_backoff(
    const RetryOptions& opts,
    const std::function<bool(const std::exception&)>& is_retryable,
    const std::function<T()>& fn) {
    static thread_local std::mt19937_64 rng(std::random_device{}());

    for (int attempt = 1; attempt <= opts.max_attempts; ++attempt) {
        try {
            return fn();
        } catch (const std::exception& err) {
            bool last_attempt = attempt == opts.max_attempts;
            if (last_attempt || !is_retryable(err)) {
                throw;
            }

            auto capped_ms = std::min<long long>(
                opts.max_delay.count(),
                static_cast<long long>(opts.base_delay.count() * std::pow(2, attempt - 1)));
            std::uniform_int_distribution<long long> dist(0, capped_ms);
            auto jittered = std::chrono::milliseconds(dist(rng)); // full jitter

            logger::warn("retrying after failure attempt={} delay_ms={} error={}",
                         attempt, jittered.count(), err.what());
            std::this_thread::sleep_for(jittered);
        }
    }
    throw std::logic_error("unreachable");
}
```

## Usage

```cpp
#include <httplib.h>

class UpstreamError : public std::runtime_error {
public:
    explicit UpstreamError(const std::string& msg) : std::runtime_error(msg) {}
};

std::string fetch_upstream(httplib::Client& client, const std::string& path) {
    RetryOptions opts;
    return retry_with_backoff<std::string>(
        opts,
        [](const std::exception& err) {
            return dynamic_cast<const UpstreamError*>(&err) != nullptr;
        },
        [&]() -> std::string {
            auto res = client.Get(path.c_str());
            if (!res) {
                throw UpstreamError("connection failed");
            }
            if (res->status >= 500) {
                throw UpstreamError("upstream returned " + std::to_string(res->status));
            }
            if (res->status >= 400) {
                throw std::runtime_error("client error " + std::to_string(res->status)); // not retried
            }
            return res->body;
        });
}
```

## Notes

- Full jitter (`uniform_int_distribution(0, capped_ms)`) avoids synchronized
  retry storms across many callers hitting the same recovering dependency.
- `is_retryable` distinguishes transient failures (`UpstreamError`,
  connection failures) from permanent ones (`4xx`, thrown as plain
  `std::runtime_error`) — only the former should be retried.
- `std::this_thread::sleep_for` blocks the calling thread; run retryable
  calls on a worker thread or thread pool, not the main/UI thread.
- Set a per-attempt timeout on the underlying client (`client.set_read_timeout`)
  and an overall deadline so retries cannot block indefinitely.
- Log every retry attempt per
  [../../logging-standards.md](../../logging-standards.md); log the final
  rethrown exception at `error` level with full context before it propagates.

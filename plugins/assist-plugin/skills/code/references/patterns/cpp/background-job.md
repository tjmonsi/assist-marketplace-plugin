# Background Job Pattern — C++ (Thread Pool)

Bounded thread pool consuming a job queue, with per-job exception isolation
and graceful shutdown. See [../../languages/cpp.md](../../languages/cpp.md)
for conventions.

## Pattern

```cpp
#include <condition_variable>
#include <functional>
#include <mutex>
#include <queue>
#include <thread>
#include <vector>

class ThreadPool {
public:
    explicit ThreadPool(size_t workers, size_t max_queue_size)
        : max_queue_size_(max_queue_size), stopping_(false) {
        for (size_t i = 0; i < workers; ++i) {
            threads_.emplace_back([this] { worker_loop(); });
        }
    }

    ~ThreadPool() { shutdown(); }

    // Returns false if the queue is full; caller decides drop or backpressure.
    bool try_enqueue(std::function<void()> job) {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            if (stopping_ || queue_.size() >= max_queue_size_) return false;
            queue_.push(std::move(job));
        }
        cv_.notify_one();
        return true;
    }

    void shutdown() {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            if (stopping_) return;
            stopping_ = true;
        }
        cv_.notify_all();
        for (auto& t : threads_) {
            if (t.joinable()) t.join();
        }
    }

private:
    void worker_loop() {
        while (true) {
            std::function<void()> job;
            {
                std::unique_lock<std::mutex> lock(mutex_);
                cv_.wait(lock, [this] { return stopping_ || !queue_.empty(); });
                if (stopping_ && queue_.empty()) return;
                job = std::move(queue_.front());
                queue_.pop();
            }
            run_isolated(job);
        }
    }

    void run_isolated(const std::function<void()>& job) {
        try {
            job();
        } catch (const std::exception& err) {
            logger::error("job failed: {}", err.what());
        } catch (...) {
            logger::error("job failed with unknown exception");
        }
    }

    std::vector<std::thread> threads_;
    std::queue<std::function<void()>> queue_;
    std::mutex mutex_;
    std::condition_variable cv_;
    size_t max_queue_size_;
    bool stopping_;
};
```

## Usage from a Request Handler

```cpp
ThreadPool email_pool(/*workers=*/10, /*max_queue_size=*/1000);

void register_user_routes(httplib::Server& server) {
    server.Post("/users", [&](const httplib::Request& req, httplib::Response& res) {
        auto user = create_user(json::parse(req.body));

        bool enqueued = email_pool.try_enqueue([user_id = user.id] {
            retry_with_backoff<void>(
                RetryOptions{},
                [](const std::exception&) { return true; },
                [&] { mailer::deliver(user_id); });
        });
        if (!enqueued) {
            logger::warn("email queue full, dropping job user_id={}", user.id);
        }

        res.status = 201;
        res.set_content(json(user).dump(), "application/json");
    });
}
```

## Notes

- `run_isolated` wraps every job in `try/catch (...)` so one throwing job
  cannot crash the worker thread or the process, per
  [../../error-handling-standards.md](../../error-handling-standards.md).
- `try_enqueue` returning `false` on a full queue gives explicit backpressure
  instead of unbounded memory growth; the caller decides whether to drop,
  log, or apply backpressure upstream.
- `shutdown()` stops accepting new work implicitly (`stopping_`), wakes all
  workers, and joins them after draining the queue — call it from the
  application's shutdown sequence (e.g., on `SIGTERM`).
- For durability across process restarts, back the queue with a persistent
  broker (Redis Streams, RabbitMQ) instead of an in-memory `std::queue`.
- Combine job execution with the retry helper (see
  [retry-backoff.md](retry-backoff.md)) for transient failures inside the
  job's lambda body.

# REST CRUD — C++ (cpp-httplib)

Full Create/Read/Update/Delete endpoint set with manual validation and
explicit error handling. See [../../languages/cpp.md](../../languages/cpp.md)
for conventions.

## Pattern

```cpp
#include <httplib.h>
#include <nlohmann/json.hpp>
#include <mutex>
#include <optional>
#include <unordered_map>
#include <random>
#include <sstream>

using json = nlohmann::json;

struct Item {
    std::string id;
    std::string name;
    double price;
};

void to_json(json& j, const Item& item) {
    j = json{{"id", item.id}, {"name", item.name}, {"price", item.price}};
}

std::string generate_uuid() {
    static std::random_device rd;
    static std::mt19937_64 gen(rd());
    std::uniform_int_distribution<uint64_t> dist;
    std::ostringstream oss;
    oss << std::hex << dist(gen) << dist(gen);
    return oss.str();
}

class ItemStore {
public:
    std::optional<std::string> validate_create(const json& body) {
        if (!body.contains("name") || !body["name"].is_string() ||
            body["name"].get<std::string>().empty() || body["name"].get<std::string>().size() > 100) {
            return "name must be a non-empty string up to 100 characters";
        }
        if (!body.contains("price") || !body["price"].is_number() || body["price"].get<double>() <= 0) {
            return "price must be a positive number";
        }
        return std::nullopt;
    }

    Item create(const json& body) {
        std::lock_guard<std::mutex> lock(mutex_);
        Item item{generate_uuid(), body["name"], body["price"]};
        items_[item.id] = item;
        return item;
    }

    std::optional<Item> get(const std::string& id) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = items_.find(id);
        if (it == items_.end()) return std::nullopt;
        return it->second;
    }

    std::optional<Item> update(const std::string& id, const json& body) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = items_.find(id);
        if (it == items_.end()) return std::nullopt;
        if (body.contains("name")) it->second.name = body["name"];
        if (body.contains("price")) it->second.price = body["price"];
        return it->second;
    }

    bool remove(const std::string& id) {
        std::lock_guard<std::mutex> lock(mutex_);
        return items_.erase(id) > 0;
    }

private:
    std::mutex mutex_;
    std::unordered_map<std::string, Item> items_;
};

void register_item_routes(httplib::Server& server, ItemStore& store) {
    server.Post("/items", [&](const httplib::Request& req, httplib::Response& res) {
        json body;
        try {
            body = json::parse(req.body);
        } catch (const json::parse_error&) {
            res.status = 400;
            res.set_content(json{{"message", "invalid JSON"}}.dump(), "application/json");
            return;
        }
        if (auto err = store.validate_create(body)) {
            res.status = 422;
            res.set_content(json{{"message", *err}}.dump(), "application/json");
            return;
        }
        res.status = 201;
        res.set_content(json(store.create(body)).dump(), "application/json");
    });

    server.Get(R"(/items/(\w+))", [&](const httplib::Request& req, httplib::Response& res) {
        auto item = store.get(req.matches[1]);
        if (!item) {
            res.status = 404;
            res.set_content(json{{"message", "item not found"}}.dump(), "application/json");
            return;
        }
        res.set_content(json(*item).dump(), "application/json");
    });

    server.Put(R"(/items/(\w+))", [&](const httplib::Request& req, httplib::Response& res) {
        json body = json::parse(req.body, nullptr, false);
        if (body.is_discarded()) {
            res.status = 400;
            res.set_content(json{{"message", "invalid JSON"}}.dump(), "application/json");
            return;
        }
        auto updated = store.update(req.matches[1], body);
        if (!updated) {
            res.status = 404;
            res.set_content(json{{"message", "item not found"}}.dump(), "application/json");
            return;
        }
        res.set_content(json(*updated).dump(), "application/json");
    });

    server.Delete(R"(/items/(\w+))", [&](const httplib::Request& req, httplib::Response& res) {
        if (!store.remove(req.matches[1])) {
            res.status = 404;
            res.set_content(json{{"message", "item not found"}}.dump(), "application/json");
            return;
        }
        res.status = 204;
    });
}
```

## Notes

- Wrap every `json::parse` at a request boundary in `try/catch` (or use the
  non-throwing overload with `is_discarded()`) — malformed JSON must never
  propagate as an unhandled exception per
  [../../error-handling-standards.md](../../error-handling-standards.md).
- Validate field presence, type, and constraints explicitly before
  constructing domain objects; return `422` with a specific message.
- `std::mutex` guards the shared map for thread safety since `httplib`
  dispatches each connection on its own thread by default.
- Use regex path captures (`R"(/items/(\w+))"`) for path parameters; validate
  the captured ID format if it must match a specific shape (e.g., UUID).
- Replace `ItemStore`'s in-memory map with a database-backed repository
  behind the same interface for production use.

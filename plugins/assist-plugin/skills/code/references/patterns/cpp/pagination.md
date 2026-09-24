# Pagination — C++ (cpp-httplib)

Offset-limit pagination with sort validation, plus a cursor variant for large
tables. See [../../languages/cpp.md](../../languages/cpp.md) for
conventions.

## Offset-Limit Pattern

```cpp
#include <httplib.h>
#include <nlohmann/json.hpp>
#include <algorithm>
#include <set>
#include <string>

using json = nlohmann::json;

const std::set<std::string> kAllowedSortFields = {"created_at", "name"};
const std::set<std::string> kAllowedSortOrders = {"asc", "desc"};

int parse_clamped(const std::string& raw, int def, int lo, int hi) {
    if (raw.empty()) return def;
    try {
        int value = std::stoi(raw);
        return std::clamp(value, lo, hi);
    } catch (...) {
        return def;
    }
}

void register_list_route(httplib::Server& server, ItemRepository& repo) {
    server.Get("/items", [&](const httplib::Request& req, httplib::Response& res) {
        int limit = parse_clamped(req.get_param_value("limit"), 20, 1, 100);
        int offset = parse_clamped(req.get_param_value("offset"), 0, 0, INT32_MAX);

        std::string sort_by = req.has_param("sort_by") ? req.get_param_value("sort_by") : "created_at";
        std::string sort_order = req.has_param("sort_order") ? req.get_param_value("sort_order") : "desc";

        if (!kAllowedSortFields.count(sort_by) || !kAllowedSortOrders.count(sort_order)) {
            res.status = 400;
            res.set_content(json{{"message", "invalid sort parameter"}}.dump(), "application/json");
            return;
        }

        auto [items, total] = repo.list(limit, offset, sort_by, sort_order);
        json body = {{"items", items}, {"total", total}, {"limit", limit}, {"offset", offset}};
        res.set_content(body.dump(), "application/json");
    });
}
```

## Cursor Pattern

```cpp
#include <cppcodec/base64_url.hpp>

std::string encode_cursor(const std::string& created_at, const std::string& id) {
    std::string raw = created_at + "|" + id;
    return cppcodec::base64_url::encode(raw);
}

std::pair<std::string, std::string> decode_cursor(const std::string& cursor) {
    std::string raw = cppcodec::base64_url::decode<std::string>(cursor);
    auto sep = raw.find('|');
    return {raw.substr(0, sep), raw.substr(sep + 1)};
}

void register_cursor_route(httplib::Server& server, ItemRepository& repo) {
    server.Get("/items/cursor", [&](const httplib::Request& req, httplib::Response& res) {
        int limit = parse_clamped(req.get_param_value("limit"), 20, 1, 100);

        std::optional<std::pair<std::string, std::string>> after;
        if (req.has_param("cursor")) {
            after = decode_cursor(req.get_param_value("cursor"));
        }

        auto rows = repo.list_after(after, limit + 1);
        bool has_more = static_cast<int>(rows.size()) > limit;
        if (has_more) rows.resize(limit);

        json body;
        body["items"] = rows;
        body["next_cursor"] = has_more
            ? json(encode_cursor(rows.back().created_at, rows.back().id))
            : json(nullptr);
        res.set_content(body.dump(), "application/json");
    });
}
```

## Notes

- Validate `sort_by`/`sort_order` against a fixed `std::set` before it
  reaches the query layer — never interpolate raw query parameters into SQL.
- `std::clamp` bounds `limit`/`offset` without a separate rejection path;
  reject with `400` instead if strict input validation is required.
- The compound cursor (`created_at` + `id`) keeps ordering deterministic when
  multiple rows share a timestamp.
- `repo.list_after` should fetch `limit + 1` rows so `has_more` is derived
  without a separate `COUNT(*)` query.
- Prefer cursor pagination for large or high-write tables; offset pagination
  is acceptable for small, page-numbered admin views.

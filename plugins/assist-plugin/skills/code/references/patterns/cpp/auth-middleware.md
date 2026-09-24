# JWT Auth Middleware — C++ (cpp-httplib)

Bearer JWT verification as a `set_pre_routing_handler`, with a role-based
guard. See [../../languages/cpp.md](../../languages/cpp.md) for conventions.

## Pattern

```cpp
#include <httplib.h>
#include <jwt-cpp/jwt.h>
#include <nlohmann/json.hpp>
#include <optional>
#include <set>
#include <string>

using json = nlohmann::json;

struct AuthUser {
    std::string sub;
    std::set<std::string> roles;
};

std::optional<AuthUser> verify_token(const std::string& token, const std::string& secret) {
    try {
        auto decoded = jwt::decode(token);
        auto verifier = jwt::verify()
            .allow_algorithm(jwt::algorithm::hs256{secret})
            .with_issuer("app");
        verifier.verify(decoded); // throws on invalid signature or expired exp

        AuthUser user;
        user.sub = decoded.get_subject();
        if (decoded.has_payload_claim("roles")) {
            for (auto& r : decoded.get_payload_claim("roles").as_array()) {
                user.roles.insert(r.get<std::string>());
            }
        }
        return user;
    } catch (const std::exception&) {
        return std::nullopt; // invalid, expired, or malformed token
    }
}

httplib::Server::HandlerWithResponse authenticate(const std::string& secret) {
    return [secret](const httplib::Request& req, httplib::Response& res) {
        auto it = req.headers.find("Authorization");
        if (it == req.headers.end() || it->second.rfind("Bearer ", 0) != 0) {
            res.status = 401;
            res.set_content(json{{"message", "missing bearer token"}}.dump(), "application/json");
            return httplib::Server::HandlerResponse::Handled;
        }
        auto token = it->second.substr(7);
        auto user = verify_token(token, secret);
        if (!user) {
            res.status = 401;
            res.set_content(json{{"message", "invalid or expired token"}}.dump(), "application/json");
            return httplib::Server::HandlerResponse::Handled;
        }
        // Stash on request via a side map keyed by connection, or re-verify
        // inside the handler; cpp-httplib has no built-in per-request context.
        return httplib::Server::HandlerResponse::Unhandled;
    };
}
```

## Usage

```cpp
void register_admin_routes(httplib::Server& server, const std::string& secret) {
    server.Delete(R"(/admin/users/(\w+))", [&, secret](const httplib::Request& req, httplib::Response& res) {
        auto it = req.headers.find("Authorization");
        auto token = (it != req.headers.end() && it->second.rfind("Bearer ", 0) == 0)
            ? it->second.substr(7) : "";
        auto user = verify_token(token, secret);
        if (!user) {
            res.status = 401;
            res.set_content(json{{"message", "missing or invalid token"}}.dump(), "application/json");
            return;
        }
        if (!user->roles.count("admin")) {
            res.status = 403;
            res.set_content(json{{"message", "insufficient role"}}.dump(), "application/json");
            return;
        }
        delete_user(req.matches[1]);
        res.status = 204;
    });
}
```

## Notes

- `allow_algorithm(jwt::algorithm::hs256{secret})` pins the expected
  algorithm; `jwt-cpp`'s verifier rejects tokens signed with a different
  algorithm and rejects expired `exp` claims automatically during `.verify()`.
- Return `401` for missing/invalid/expired tokens, `403` once identity is
  established but the role check fails — never conflate the two.
- `cpp-httplib` has no native per-request context object; either re-verify
  the token inside each protected handler (shown above) or maintain a
  thread-local/connection-keyed map populated by a pre-routing handler.
- Load the JWT secret (or RS256 public key) from environment/secret manager,
  never hardcode it in source.
- For session-based auth, verify a signed, `HttpOnly`, `Secure` cookie
  against a server-side session store instead of decoding a bearer token.

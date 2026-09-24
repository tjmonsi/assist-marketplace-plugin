# JWT Auth Middleware — Kotlin (Ktor)

Bearer JWT verification via Ktor's `Authentication` plugin, with a
role-based guard. See [../../languages/kotlin.md](../../languages/kotlin.md)
for conventions.

## Pattern

```kotlin
import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*

fun Application.configureAuth() {
    val secret = environment.config.property("jwt.secret").getString()
    val issuer = environment.config.property("jwt.issuer").getString()

    install(Authentication) {
        jwt("auth-jwt") {
            realm = "app"
            verifier(
                JWT.require(Algorithm.HMAC256(secret))
                    .withIssuer(issuer)
                    .build()
            )
            validate { credential ->
                val sub = credential.payload.subject
                if (sub != null) JWTPrincipal(credential.payload) else null
            }
            challenge { _, _ ->
                call.respond(HttpStatusCode.Unauthorized, mapOf("message" to "Invalid or expired token"))
            }
        }
    }
}

fun JWTPrincipal.roles(): List<String> =
    payload.getClaim("roles").asList(String::class.java) ?: emptyList()
```

## Usage

```kotlin
fun Route.protectedRoutes() {
    authenticate("auth-jwt") {
        get("/me") {
            val principal = call.principal<JWTPrincipal>()!!
            call.respond(mapOf("sub" to principal.payload.subject))
        }

        delete("/admin/users/{id}") {
            val principal = call.principal<JWTPrincipal>()!!
            if ("admin" !in principal.roles()) {
                return@delete call.respond(HttpStatusCode.Forbidden, mapOf("message" to "Insufficient role"))
            }
            deleteUser(call.parameters["id"]!!)
            call.respond(HttpStatusCode.NoContent)
        }
    }
}
```

## Notes

- `Algorithm.HMAC256(secret)` pins the expected signing algorithm; the
  `com.auth0.jwt` verifier rejects tokens signed with any other algorithm or
  an expired `exp` claim automatically.
- The `challenge` block controls the exact `401` response body — keep it
  generic; never leak verifier internals to the client.
- `authenticate("auth-jwt") { ... }` wraps only the routes that require
  identity; public routes stay outside the block.
- Check role claims inside the handler (or a custom `RouteSelector`) and
  return `403` when identity is valid but authorization fails — do not
  conflate with `401`.
- Load `jwt.secret`/`jwt.issuer` from `application.conf` backed by
  environment variables or a secret manager, never hardcode.
- For session-based auth, use Ktor's `sessions` plugin with a signed,
  `HttpOnly`, `Secure` cookie backed by a server-side store instead of JWT.

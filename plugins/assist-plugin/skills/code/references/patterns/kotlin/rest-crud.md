# REST CRUD — Kotlin (Ktor)

Full Create/Read/Update/Delete endpoint set with request validation and
structured error responses. See
[../../languages/kotlin.md](../../languages/kotlin.md) for conventions.

## Pattern

```kotlin
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.*
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

@Serializable
data class Item(val id: String, val name: String, val price: Double)

@Serializable
data class CreateItemRequest(val name: String, val price: Double) {
    fun validate(): List<String> = buildList {
        if (name.isBlank() || name.length > 100) add("name must be 1-100 characters")
        if (price <= 0) add("price must be greater than 0")
    }
}

@Serializable
data class UpdateItemRequest(val name: String? = null, val price: Double? = null) {
    fun validate(): List<String> = buildList {
        name?.let { if (it.isBlank() || it.length > 100) add("name must be 1-100 characters") }
        price?.let { if (it <= 0) add("price must be greater than 0") }
    }
}

private val db = ConcurrentHashMap<String, Item>()

fun Route.itemRoutes() {
    route("/items") {
        post {
            val payload = call.receive<CreateItemRequest>()
            val errors = payload.validate()
            if (errors.isNotEmpty()) {
                return@post call.respond(HttpStatusCode.UnprocessableEntity, mapOf("errors" to errors))
            }
            val item = Item(id = UUID.randomUUID().toString(), name = payload.name, price = payload.price)
            db[item.id] = item
            call.respond(HttpStatusCode.Created, item)
        }

        get("/{id}") {
            val id = call.parameters["id"]!!
            val item = db[id] ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("message" to "Item not found"))
            call.respond(item)
        }

        put("/{id}") {
            val id = call.parameters["id"]!!
            val existing = db[id] ?: return@put call.respond(HttpStatusCode.NotFound, mapOf("message" to "Item not found"))

            val payload = call.receive<UpdateItemRequest>()
            val errors = payload.validate()
            if (errors.isNotEmpty()) {
                return@put call.respond(HttpStatusCode.UnprocessableEntity, mapOf("errors" to errors))
            }
            val updated = existing.copy(
                name = payload.name ?: existing.name,
                price = payload.price ?: existing.price,
            )
            db[id] = updated
            call.respond(updated)
        }

        delete("/{id}") {
            val id = call.parameters["id"]!!
            if (db.remove(id) == null) {
                return@delete call.respond(HttpStatusCode.NotFound, mapOf("message" to "Item not found"))
            }
            call.respond(HttpStatusCode.NoContent)
        }
    }
}
```

## Notes

- Validate immediately after `call.receive<T>()` and return `422` with the
  error list; never let unvalidated input reach the persistence layer.
- Register a global `StatusPages` plugin (`install(StatusPages) { ... }`) to
  map uncaught exceptions to consistent JSON error bodies per
  [../../error-handling-standards.md](../../error-handling-standards.md).
- Nullable fields (`String? = null`) on the update request distinguish
  "omitted" from "explicitly cleared"; use `.copy()` for immutable partial
  updates.
- `ConcurrentHashMap` is safe for concurrent access in this example; replace
  with a repository backed by Exposed/R2DBC in production.
- Keep route handlers thin — delegate business logic to a service class
  injected via Koin/manual DI, not instantiated inline.

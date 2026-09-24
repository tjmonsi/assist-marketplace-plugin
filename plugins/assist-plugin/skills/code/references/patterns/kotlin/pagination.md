# Pagination — Kotlin (Ktor)

Offset-limit pagination with sort validation, plus a cursor variant for large
tables. See [../../languages/kotlin.md](../../languages/kotlin.md) for
conventions.

## Offset-Limit Pattern

```kotlin
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.respond
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class Page<T>(val items: List<T>, val total: Long, val limit: Int, val offset: Int)

private val allowedSortFields = setOf("createdAt", "name")
private val allowedSortOrders = setOf("asc", "desc")

fun Route.listItemsRoute(repo: ItemRepository) {
    get("/items") {
        val limit = (call.request.queryParameters["limit"]?.toIntOrNull() ?: 20).coerceIn(1, 100)
        val offset = (call.request.queryParameters["offset"]?.toIntOrNull() ?: 0).coerceAtLeast(0)
        val sortBy = call.request.queryParameters["sortBy"] ?: "createdAt"
        val sortOrder = call.request.queryParameters["sortOrder"] ?: "desc"

        if (sortBy !in allowedSortFields || sortOrder !in allowedSortOrders) {
            return@get call.respond(HttpStatusCode.BadRequest, mapOf("message" to "invalid sort parameter"))
        }

        val (items, total) = repo.list(limit, offset, sortBy, sortOrder)
        call.respond(Page(items, total, limit, offset))
    }
}
```

## Cursor Pattern

```kotlin
import java.util.Base64

@Serializable
data class CursorPage<T>(val items: List<T>, val nextCursor: String?)

private fun encodeCursor(createdAt: String, id: String): String =
    Base64.getUrlEncoder().withoutPadding().encodeToString("$createdAt|$id".toByteArray())

private fun decodeCursor(cursor: String): Pair<String, String> {
    val raw = String(Base64.getUrlDecoder().decode(cursor))
    val (createdAt, id) = raw.split("|", limit = 2)
    return createdAt to id
}

fun Route.listItemsCursorRoute(repo: ItemRepository) {
    get("/items/cursor") {
        val limit = (call.request.queryParameters["limit"]?.toIntOrNull() ?: 20).coerceIn(1, 100)
        val cursorParam = call.request.queryParameters["cursor"]
        val after = cursorParam?.let { decodeCursor(it) }

        val rows = repo.listAfter(after, limit + 1)
        val hasMore = rows.size > limit
        val items = rows.take(limit)
        val nextCursor = if (hasMore) encodeCursor(items.last().createdAt, items.last().id) else null

        call.respond(CursorPage(items, nextCursor))
    }
}
```

## Notes

- `coerceIn(1, 100)` bounds `limit` without a separate error path for
  out-of-range values; validate `sortBy`/`sortOrder` against a fixed `Set`
  before it reaches the query layer — never interpolate raw params into SQL.
- The compound cursor (`createdAt` + `id`) keeps ordering deterministic when
  multiple rows share a timestamp.
- `repo.listAfter` should fetch `limit + 1` rows internally so `hasMore` is
  derived without a separate count query.
- Prefer cursor pagination for large or high-write tables; offset pagination
  is acceptable for small, page-numbered admin views.

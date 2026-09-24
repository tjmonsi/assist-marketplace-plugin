# Pagination — Rust (Axum)

Offset-limit pagination with sort validation, plus a cursor variant for large
tables. See [../../languages/rust.md](../../languages/rust.md) for
conventions.

## Offset-Limit Pattern

```rust
use axum::{extract::{Query, State}, Json};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct ListQuery {
    #[serde(default = "default_limit")]
    limit: u32,
    #[serde(default)]
    offset: u32,
    #[serde(default = "default_sort_by")]
    sort_by: String,
    #[serde(default = "default_sort_order")]
    sort_order: String,
}

fn default_limit() -> u32 { 20 }
fn default_sort_by() -> String { "created_at".into() }
fn default_sort_order() -> String { "desc".into() }

const ALLOWED_SORT_FIELDS: &[&str] = &["created_at", "name"];
const ALLOWED_SORT_ORDERS: &[&str] = &["asc", "desc"];

#[derive(Serialize)]
pub struct Page<T> {
    items: Vec<T>,
    total: i64,
    limit: u32,
    offset: u32,
}

pub async fn list_items(
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Page<Item>>, ApiError> {
    let limit = q.limit.clamp(1, 100);
    if !ALLOWED_SORT_FIELDS.contains(&q.sort_by.as_str())
        || !ALLOWED_SORT_ORDERS.contains(&q.sort_order.as_str())
    {
        return Err(ApiError::Validation("invalid sort parameter".into()));
    }

    let (items, total) = state
        .repo
        .list(limit, q.offset, &q.sort_by, &q.sort_order)
        .await
        .map_err(|_| ApiError::Internal)?;

    Ok(Json(Page { items, total, limit, offset: q.offset }))
}
```

## Cursor Pattern

```rust
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};

#[derive(Serialize)]
pub struct CursorPage<T> {
    items: Vec<T>,
    next_cursor: Option<String>,
}

fn encode_cursor(created_at: &str, id: &str) -> String {
    URL_SAFE_NO_PAD.encode(format!("{created_at}|{id}"))
}

fn decode_cursor(cursor: &str) -> Result<(String, String), ApiError> {
    let raw = URL_SAFE_NO_PAD
        .decode(cursor)
        .map_err(|_| ApiError::Validation("invalid cursor".into()))?;
    let raw = String::from_utf8(raw).map_err(|_| ApiError::Validation("invalid cursor".into()))?;
    let (created_at, id) = raw
        .split_once('|')
        .ok_or_else(|| ApiError::Validation("invalid cursor".into()))?;
    Ok((created_at.to_string(), id.to_string()))
}

pub async fn list_items_cursor(
    State(state): State<AppState>,
    Query(q): Query<CursorQuery>,
) -> Result<Json<CursorPage<Item>>, ApiError> {
    let limit = q.limit.unwrap_or(20).clamp(1, 100);
    let after = q.cursor.as_deref().map(decode_cursor).transpose()?;

    let mut rows = state
        .repo
        .list_after(after, limit + 1)
        .await
        .map_err(|_| ApiError::Internal)?;

    let has_more = rows.len() as u32 > limit;
    rows.truncate(limit as usize);
    let next_cursor = has_more
        .then(|| rows.last().map(|r| encode_cursor(&r.created_at, &r.id)))
        .flatten();

    Ok(Json(CursorPage { items: rows, next_cursor }))
}
```

## Notes

- `u32::clamp(1, 100)` bounds `limit` without a separate validation error
  path; reject invalid `sort_by`/`sort_order` explicitly against a `const`
  allow-list rather than passing raw strings into a query builder.
- The compound cursor (`created_at` + `id`) keeps ordering deterministic when
  multiple rows share a timestamp.
- `list_after` should fetch `limit + 1` rows so `has_more` is computed
  without an extra `COUNT(*)` query.
- Prefer cursor pagination for large or high-write tables; offset pagination
  is fine for small, page-numbered admin views.

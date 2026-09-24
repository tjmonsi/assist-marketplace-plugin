# REST CRUD — Rust (Axum)

Full Create/Read/Update/Delete endpoint set with `validator` and typed error
responses. See [../../languages/rust.md](../../languages/rust.md) for
conventions.

## Pattern

```rust
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::{Arc, RwLock}};
use uuid::Uuid;
use validator::Validate;

#[derive(Clone)]
pub struct AppState {
    db: Arc<RwLock<HashMap<String, Item>>>,
}

#[derive(Serialize, Clone)]
pub struct Item {
    id: String,
    name: String,
    price: f64,
}

#[derive(Deserialize, Validate)]
pub struct CreateItem {
    #[validate(length(min = 1, max = 100))]
    name: String,
    #[validate(range(min = 0.01))]
    price: f64,
}

#[derive(Deserialize, Validate)]
pub struct UpdateItem {
    #[validate(length(min = 1, max = 100))]
    name: Option<String>,
    #[validate(range(min = 0.01))]
    price: Option<f64>,
}

pub enum ApiError {
    NotFound(&'static str),
    Validation(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            ApiError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.to_string()),
            ApiError::Validation(msg) => (StatusCode::UNPROCESSABLE_ENTITY, msg),
        };
        (status, Json(serde_json::json!({ "message": message }))).into_response()
    }
}

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/items", post(create_item))
        .route("/items/:id", get(get_item).put(update_item).delete(delete_item))
        .with_state(state)
}

async fn create_item(
    State(state): State<AppState>,
    Json(payload): Json<CreateItem>,
) -> Result<(StatusCode, Json<Item>), ApiError> {
    payload.validate().map_err(|e| ApiError::Validation(e.to_string()))?;

    let item = Item { id: Uuid::new_v4().to_string(), name: payload.name, price: payload.price };
    state.db.write().unwrap().insert(item.id.clone(), item.clone());
    Ok((StatusCode::CREATED, Json(item)))
}

async fn get_item(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Item>, ApiError> {
    let db = state.db.read().unwrap();
    db.get(&id).cloned().map(Json).ok_or(ApiError::NotFound("item not found"))
}

async fn update_item(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateItem>,
) -> Result<Json<Item>, ApiError> {
    payload.validate().map_err(|e| ApiError::Validation(e.to_string()))?;

    let mut db = state.db.write().unwrap();
    let item = db.get_mut(&id).ok_or(ApiError::NotFound("item not found"))?;
    if let Some(name) = payload.name {
        item.name = name;
    }
    if let Some(price) = payload.price {
        item.price = price;
    }
    Ok(Json(item.clone()))
}

async fn delete_item(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    let mut db = state.db.write().unwrap();
    db.remove(&id).ok_or(ApiError::NotFound("item not found"))?;
    Ok(StatusCode::NO_CONTENT)
}
```

## Notes

- `IntoResponse` on `ApiError` centralizes error-to-HTTP mapping; handlers
  return `Result<_, ApiError>` and use `?` instead of manual status juggling.
- `validator::Validate` enforces field constraints declaratively; call
  `.validate()` immediately after deserialization, before mutating state.
- `RwLock` allows concurrent reads (`get_item`) while serializing writes;
  swap for a connection pool (`sqlx::PgPool`) in production and drop the lock.
- Never `.unwrap()` on the poisoned-lock path in production code without a
  documented panic strategy — prefer `RwLock::read()`/`write()` error
  handling or a crash-only design per
  [../../error-handling-standards.md](../../error-handling-standards.md).
- `Option<T>` fields on `UpdateItem` distinguish "omitted" from "set" for
  partial updates.

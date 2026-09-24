# JWT Auth Middleware — Rust (Axum)

Bearer JWT verification as an Axum extractor, with a role-based guard. See
[../../languages/rust.md](../../languages/rust.md) for conventions.

## Pattern

```rust
use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    RequestPartsExt,
};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use std::sync::OnceLock;

#[derive(Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    #[serde(default)]
    pub roles: Vec<String>,
    pub exp: usize,
}

fn jwt_secret() -> &'static [u8] {
    static SECRET: OnceLock<Vec<u8>> = OnceLock::new();
    SECRET.get_or_init(|| std::env::var("JWT_SECRET").expect("JWT_SECRET not set").into_bytes())
}

pub struct AuthUser(pub Claims);

impl<S: Send + Sync> FromRequestParts<S> for AuthUser {
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let TypedHeader(Authorization(bearer)) = parts
            .extract::<TypedHeader<Authorization<Bearer>>>()
            .await
            .map_err(|_| (StatusCode::UNAUTHORIZED, "missing bearer token"))?;

        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = true;

        let token_data = decode::<Claims>(
            bearer.token(),
            &DecodingKey::from_secret(jwt_secret()),
            &validation,
        )
        .map_err(|_| (StatusCode::UNAUTHORIZED, "invalid or expired token"))?;

        Ok(AuthUser(token_data.claims))
    }
}

pub fn require_role(user: &AuthUser, role: &str) -> Result<(), (StatusCode, &'static str)> {
    if user.0.roles.iter().any(|r| r == role) {
        Ok(())
    } else {
        Err((StatusCode::FORBIDDEN, "insufficient role"))
    }
}
```

## Usage

```rust
async fn read_profile(AuthUser(claims): AuthUser) -> Json<Claims> {
    Json(claims)
}

async fn delete_user(
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, &'static str)> {
    require_role(&user, "admin")?;
    delete_user_by_id(&id).await;
    Ok(StatusCode::NO_CONTENT)
}
```

## Notes

- `AuthUser` as a Axum extractor (`FromRequestParts`) runs before the handler
  body; any route that declares it as a parameter automatically requires
  authentication — missing routes simply omit the extractor.
- `Validation::new(Algorithm::HS256)` pins the expected algorithm; never
  decode without an explicit algorithm, which prevents algorithm-confusion
  attacks.
- `validate_exp = true` (default in recent `jsonwebtoken` versions, set
  explicitly for clarity) rejects expired tokens automatically.
- Return `401` for missing/invalid/expired tokens, `403` for a valid token
  lacking the required role — never conflate the two.
- Load `JWT_SECRET` from environment/secret manager via `OnceLock`, not a
  hardcoded constant; for RS256 use `DecodingKey::from_rsa_pem`.
- For session-based auth, replace the bearer extractor with a signed,
  `HttpOnly`, `Secure`, `SameSite=Lax` cookie extractor backed by a
  server-side session store.

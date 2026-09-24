# Kotlin / Android / KMP Reference

## Contents
- Mandatory Toolchain
- Kotlin-Idiomatic Rules
- Prohibited Patterns
- Coroutines Rules
- Jetpack Compose UI Patterns
- State Management (MVVM + sealed UiState)
- Navigation (Compose Navigation)
- Local Database (Room)
- API Client (Ktor)
- Authentication (Login/Logout)
- Dependency Injection (Hilt)
- Background Work (WorkManager)
- Mobile UI/UX Rules
- KMP Shared Layer Patterns
- Project Structure

## Mandatory Toolchain

| Tool | Purpose | Prohibited Alternatives |
|------|---------|------------------------|
| Kotlin 1.9+ / 2.x | Language | < 1.8 |
| Gradle (Kotlin DSL) | Build | Maven (unless existing), Groovy DSL |
| `ktlint` | Lint + format | Manual formatting |
| `detekt` | Static analysis | None for new projects |
| `kotest` or JUnit 5 | Testing | JUnit 4 for new code |
| Coroutines | Async | RxJava for new code (unless existing) |
| Jetpack Compose | UI | XML layouts for new screens |
| Hilt | DI | Manual DI or Koin (unless existing) |
| Room | Local DB | Raw SQLite, Realm (unless existing) |

## Kotlin-Idiomatic Rules

- `data class` for DTOs and value objects
- Prefer `val` over `var`; use `var` only when mutation is required
- `sealed class` / `sealed interface` for discriminated unions — not Java-style enum
- Extension functions over utility classes
- `when` expressions must be exhaustive; use `else ->` only when truly necessary
- No checked exceptions — use `Result<T>` or sealed error types

## Prohibited Patterns

| Pattern | Why | Fix |
|---------|-----|-----|
| `!!` (non-null assertion) | Runtime NPE | `?.let`, `?:`, or restructure |
| `lateinit var` without init check | NPE risk | Nullable + `?.` or `lazy {}` |
| Java-style static helpers | Non-idiomatic | Companion object or top-level functions |
| `System.out.println` | Uncaptured output | `Timber.d()` for Android, SLF4J for backend |
| `runBlocking` in production | Blocks thread pool | `suspend` throughout |
| XML layouts for new screens | Legacy | Jetpack Compose |
| `findViewbyId` | Legacy | Compose or ViewBinding |
| Storing tokens in SharedPreferences unencrypted | Security risk | EncryptedSharedPreferences or DataStore |

## Coroutines Rules

- `suspend` for all I/O-bound operations
- Structured concurrency: `coroutineScope {}`, `supervisorScope {}`
- Never use `GlobalScope` in app code (exception: Swift/ObjC boundary adapter)
- Dispatchers: `Dispatchers.IO` for I/O, `Dispatchers.Default` for CPU, `Dispatchers.Main` for UI
- Use `viewModelScope` in ViewModels, `lifecycleScope` in Activities/Fragments

## Jetpack Compose UI Patterns

**State hoisting:** stateless composables receive state via parameters, emit events up:

```kotlin
// Stateless — reusable, testable
@Composable
fun LoginForm(
    username: String,
    password: String,
    onUsernameChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onSubmit: () -> Unit,
    modifier: Modifier = Modifier
) { /* TextField + Button */ }

// Stateful — screen-level only
@Composable
fun LoginScreen(viewModel: LoginViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    LoginForm(
        username = uiState.username,
        password = uiState.password,
        onUsernameChange = viewModel::updateUsername,
        onPasswordChange = viewModel::updatePassword,
        onSubmit = viewModel::login
    )
}
```

- Use `Modifier` as first optional parameter on every public composable
- Side effects: `LaunchedEffect`, `DisposableEffect` — never launch coroutines outside effect handlers
- `remember` for local UI state, `rememberSaveable` for surviving config changes
- `@Preview` on every significant composable
- Use Material3 components (`androidx.compose.material3`)

## State Management (MVVM + sealed UiState)

Every screen uses a ViewModel with a sealed UiState:

```kotlin
sealed interface TasksUiState {
    data object Loading : TasksUiState
    data class Success(val items: List<Task>) : TasksUiState
    data class Error(val message: String) : TasksUiState
}

@HiltViewModel
class TasksViewModel @Inject constructor(
    private val repository: TaskRepository
) : ViewModel() {
    val uiState: StateFlow<TasksUiState> = repository.getTasksStream()
        .map<List<Task>, TasksUiState> { TasksUiState.Success(it) }
        .catch { emit(TasksUiState.Error(it.message ?: "Unknown error")) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), TasksUiState.Loading)
}
```

Rules:
- Always handle Loading, Success, and Error states in the Composable
- Use `collectAsStateWithLifecycle()` — not `collectAsState()`
- `WhileSubscribed(5000)` to survive config changes without re-fetching

## Navigation (Compose Navigation)

```kotlin
@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    NavHost(navController, startDestination = "login") {
        composable("login") { LoginScreen(onLoginSuccess = { navController.navigate("home") }) }
        composable("home") { HomeScreen() }
        composable("task/{id}") { backStackEntry ->
            TaskDetailScreen(taskId = backStackEntry.arguments?.getString("id") ?: "")
        }
    }
}
```

## Local Database (Room)

```kotlin
@Entity(tableName = "tasks")
data class TaskEntity(
    @PrimaryKey val id: String,
    val title: String,
    val completed: Boolean = false,
    @ColumnInfo(name = "created_at") val createdAt: Long = System.currentTimeMillis()
)

@Dao
interface TaskDao {
    @Query("SELECT * FROM tasks ORDER BY created_at DESC")
    fun observeAll(): Flow<List<TaskEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(task: TaskEntity)

    @Delete
    suspend fun delete(task: TaskEntity)
}

@Database(entities = [TaskEntity::class], version = 1, exportSchema = true)
abstract class AppDatabase : RoomDatabase() {
    abstract fun taskDao(): TaskDao
}
```

Rules:
- DAOs return `Flow<T>` for observable queries, `suspend` for writes
- Use `OnConflictStrategy.REPLACE` for upsert pattern
- `exportSchema = true` for migration tracking
- Provide via Hilt `@Module` with `@Singleton` scope

## API Client (Ktor)

```kotlin
val httpClient = HttpClient(CIO) {
    install(ContentNegotiation) { json() }
    install(Auth) {
        bearer {
            loadTokens { BearerTokens(tokenStore.accessToken, tokenStore.refreshToken) }
            refreshTokens {
                val response: TokenResponse = client.post("auth/refresh") {
                    setBody(RefreshRequest(oldTokens?.refreshToken ?: ""))
                }.body()
                BearerTokens(response.accessToken, response.refreshToken)
            }
        }
    }
    install(HttpTimeout) { requestTimeoutMillis = 30_000 }
    defaultRequest { url("https://api.example.com/") }
}
```

Rules:
- Use Ktor in `commonMain` for KMP compatibility
- Always install `HttpTimeout`
- Bearer auth with automatic token refresh
- JSON serialization via `kotlinx.serialization`

## Authentication (Login/Logout)

```kotlin
class AuthRepository @Inject constructor(
    private val api: HttpClient,
    private val tokenStore: TokenStore,  // EncryptedSharedPreferences or DataStore
) {
    suspend fun login(email: String, password: String): Result<User> = runCatching {
        val response: AuthResponse = api.post("auth/login") {
            setBody(LoginRequest(email, password))
        }.body()
        tokenStore.save(response.accessToken, response.refreshToken)
        response.user
    }

    suspend fun logout() {
        runCatching { api.post("auth/logout") }
        tokenStore.clear()
    }

    fun isLoggedIn(): Flow<Boolean> = tokenStore.hasValidToken()
}
```

Rules:
- Store tokens in `EncryptedSharedPreferences` or `DataStore` — never plain SharedPreferences
- Clear tokens on logout — both local and server-side invalidation
- Use `Flow<Boolean>` for auth state observation — drives navigation guard
- Handle token expiry with Ktor `refreshTokens` block

## Dependency Injection (Hilt)

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides @Singleton
    fun provideDatabase(@ApplicationContext ctx: Context): AppDatabase =
        Room.databaseBuilder(ctx, AppDatabase::class.java, "app.db").build()

    @Provides
    fun provideTaskDao(db: AppDatabase): TaskDao = db.taskDao()

    @Provides @Singleton
    fun provideHttpClient(tokenStore: TokenStore): HttpClient = /* Ktor setup */
}

@HiltViewModel
class TasksViewModel @Inject constructor(
    private val repository: TaskRepository
) : ViewModel() { /* ... */ }
```

Rules:
- `@Singleton` for database, HTTP client, token store
- `@ViewModelScoped` for per-ViewModel shared deps
- ViewModels annotated `@HiltViewModel` + `@Inject constructor`

## Background Work (WorkManager)

```kotlin
class SyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        return try {
            // Sync local data with server
            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }
}

// Schedule
val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
    .setConstraints(Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .setRequiresBatteryNotLow(true)
        .build())
    .build()

WorkManager.getInstance(context).enqueueUniquePeriodicWork(
    "sync", ExistingPeriodicWorkPolicy.KEEP, syncRequest
)
```

Rules:
- Use `CoroutineWorker` for suspend-compatible work
- Always set constraints (network, battery)
- Use `enqueueUniquePeriodicWork` to prevent duplicate jobs
- Max 3 retries with exponential backoff
- For immediate foreground work: `setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)`

## Mobile UI/UX Rules

- **Loading states**: show skeleton/shimmer, never blank screen
- **Error states**: actionable message + retry button, never raw exception text
- **Empty states**: helpful message + CTA (e.g., "No tasks yet. Tap + to create one.")
- **Offline support**: cache API responses in Room, show cached data with "offline" indicator
- **Pull to refresh**: `SwipeRefresh` composable for all list screens
- **Touch targets**: minimum 48dp for all interactive elements
- **Back navigation**: handle system back button via `BackHandler`
- **Keyboard**: `imePadding()` on forms to avoid keyboard overlap
- **Dark theme**: support via `MaterialTheme` with `darkColorScheme()`
- **Accessibility**: `contentDescription` on all icons and images, `semantics` for custom components

## KMP Shared Layer Patterns

### expect/actual

- Every `expect` declaration must have an `actual` in every target
- Prefer `expect interface` over `expect class` for testability
- Do not use platform-specific HTTP clients in `commonMain`

### Ktor Client in commonMain

- Configure via `HttpClient { install(ContentNegotiation) { json() } }`
- Set `HttpTimeout` with explicit `requestTimeoutMillis`

### Coroutines at Swift/ObjC Boundary

- `GlobalScope.launch` acceptable only at the Swift/ObjC boundary adapter layer
- Use `fun interface NativeCallback` pattern with `(result, error)` signature

## Project Structure

### Android App (Compose + Hilt + Room)

```
app/src/main/kotlin/<package>/
  di/                        # Hilt modules (AppModule, NetworkModule)
  data/
    local/
      db/                    # Room database, DAOs, entities
      datastore/             # DataStore preferences, token store
    remote/
      api/                   # Ktor client, API service interfaces
      dto/                   # Network DTOs (serializable)
    repository/              # Repository implementations
  domain/
    model/                   # Domain models (not entities or DTOs)
    usecase/                 # Use cases (single-purpose business logic)
  ui/
    navigation/              # NavHost, routes
    theme/                   # Material3 theme, colors, typography
    screens/
      login/                 # LoginScreen.kt, LoginViewModel.kt
      home/                  # HomeScreen.kt, HomeViewModel.kt
      tasks/                 # TasksScreen.kt, TasksViewModel.kt
    components/              # Shared composables (LoadingIndicator, ErrorView)
  worker/                    # WorkManager workers (SyncWorker)
  App.kt                     # @HiltAndroidApp Application class
app/src/test/                # Unit tests
app/src/androidTest/         # Instrumented tests
build.gradle.kts
```

### KMP Shared Module

```
shared/src/
  commonMain/kotlin/<package>/
    data/                    # Repositories, DTOs, Ktor client
    domain/                  # Use cases, domain models
    platform/                # expect declarations
  androidMain/kotlin/<package>/
    platform/                # actual implementations
  iosMain/kotlin/<package>/
    platform/                # actual implementations
  commonTest/
build.gradle.kts
```

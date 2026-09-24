# Kotlin Integration Testing

Integration testing patterns for Kotlin projects using Hilt, Room, and MockWebServer.

## Setup

### Dependencies (build.gradle.kts)
```kotlin
// Test dependencies
testImplementation("junit:junit:4.13.2")
testImplementation("androidx.test.ext:junit:1.1.5")
testImplementation("com.google.dagger:hilt-android-testing:2.46")
testImplementation("com.squareup.okhttp3:mockwebserver:4.11.0")
testImplementation("androidx.room:room-testing:2.5.2")
testImplementation("org.robolectric:robolectric:4.10.3")
testImplementation("kotlinx-coroutines-test:1.7.1")

// Hilt
implementation("com.google.dagger:hilt-android:2.46")
kapt("com.google.dagger:hilt-compiler:2.46")

// Room
implementation("androidx.room:room-runtime:2.5.2")
kapt("androidx.room:room-compiler:2.5.2")
```

## Test Setup with Hilt

```kotlin
// tests/HiltTest.kt
@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
class UserApiIntegrationTest {
    @get:Rule
    val hiltRule = HiltAndroidRule(this)

    private lateinit var mockServer: MockWebServer
    private lateinit var database: AppDatabase

    @Before
    fun setup() {
        hiltRule.inject()
        mockServer = MockWebServer()
        mockServer.start()
        
        // Create in-memory test database
        database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            AppDatabase::class.java
        ).build()
    }

    @After
    fun tearDown() {
        mockServer.shutdown()
        database.close()
    }
}
```

## Database Testing with Room

### In-memory database per test

```kotlin
// tests/UserDaoTest.kt
@RunWith(AndroidJUnit4::class)
class UserDaoTest {
    private lateinit var database: AppDatabase
    private lateinit var userDao: UserDao

    @Before
    fun createDb() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        database = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
            .allowMainThreadQueries() // For testing only
            .build()
        userDao = database.userDao()
    }

    @After
    fun closeDb() {
        database.close()
    }

    @Test
    fun insertAndRetrieveUser() {
        val user = User(id = 1, name = "Alice", email = "alice@test.com")
        userDao.insert(user)

        val retrieved = userDao.getUserById(1)
        assertThat(retrieved.name).isEqualTo("Alice")
    }
}
```

## HTTP Client Testing with MockWebServer

```kotlin
// tests/ApiServiceTest.kt
@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
class ApiServiceTest {
    @get:Rule
    val hiltRule = HiltAndroidRule(this)

    @BindValue
    @Mock
    lateinit var mockServer: MockWebServer

    private lateinit var apiService: UserApiService

    @Before
    fun setup() {
        hiltRule.inject()
        mockServer = MockWebServer()
        mockServer.start()
        
        // Create retrofit client pointing to mock server
        val retrofit = Retrofit.Builder()
            .baseUrl(mockServer.url("/"))
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        apiService = retrofit.create(UserApiService::class.java)
    }

    @After
    fun tearDown() {
        mockServer.shutdown()
    }

    @Test
    fun fetchUsersFromAPI() {
        // Queue response
        mockServer.enqueue(MockResponse()
            .setBody("""[{"id":1,"name":"Alice","email":"alice@test.com"}]""")
            .setHeader("Content-Type", "application/json"))

        // Make request
        val users = runBlocking { apiService.getUsers() }

        // Verify response
        assertThat(users).hasSize(1)
        assertThat(users[0].name).isEqualTo("Alice")

        // Verify request
        val recordedRequest = mockServer.takeRequest()
        assertThat(recordedRequest.method).isEqualTo("GET")
        assertThat(recordedRequest.path).isEqualTo("/api/users")
    }

    @Test
    fun handleAPIError() {
        mockServer.enqueue(MockResponse().setResponseCode(500))

        val exception = assertThrows<IOException> {
            runBlocking { apiService.getUsers() }
        }
        assertThat(exception).isInstanceOf(IOException::class.java)
    }
}
```

## Coroutine Testing

```kotlin
// tests/UserRepositoryTest.kt
@RunWith(AndroidJUnit4::class)
class UserRepositoryTest {
    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun testAsyncOperation() = runTest {
        val repository = UserRepository()
        val result = repository.fetchUser(1)
        
        advanceUntilIdle() // Complete all pending tasks
        
        assertThat(result.name).isEqualTo("Expected Name")
    }
}
```

## Example Integration Test

```kotlin
// tests/UserWorkflowTest.kt
@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
class UserWorkflowIntegrationTest {
    @get:Rule
    val hiltRule = HiltAndroidRule(this)

    private lateinit var database: AppDatabase
    private lateinit var apiService: UserApiService
    private lateinit var mockServer: MockWebServer
    private lateinit var repository: UserRepository

    @Before
    fun setup() {
        hiltRule.inject()
        
        mockServer = MockWebServer()
        mockServer.start()
        
        database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            AppDatabase::class.java
        ).build()

        // Create API client
        val retrofit = Retrofit.Builder()
            .baseUrl(mockServer.url("/"))
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        apiService = retrofit.create(UserApiService::class.java)

        repository = UserRepository(database, apiService)
    }

    @After
    fun tearDown() {
        mockServer.shutdown()
        database.close()
    }

    @Test
    fun testFetchAndCacheUsers() = runBlocking {
        // Mock API response
        mockServer.enqueue(MockResponse()
            .setBody("""[{"id":1,"name":"Alice","email":"alice@test.com"}]""")
            .setHeader("Content-Type", "application/json"))

        // Fetch via repository
        val users = repository.fetchUsers()

        // Verify API was called
        val request = mockServer.takeRequest()
        assertThat(request.method).isEqualTo("GET")

        // Verify data is cached in database
        val cached = database.userDao().getAllUsers()
        assertThat(cached).hasSize(1)
        assertThat(cached[0].name).isEqualTo("Alice")
    }
}
```

## Best Practices

1. **Use Hilt for DI testing:** @HiltAndroidTest enables dependency injection in tests.
2. **In-memory database:** Room provides `inMemoryDatabaseBuilder()` for fast test isolation.
3. **MockWebServer:** Queue responses to test API integration without external dependencies.
4. **Coroutine testing:** Use `runTest` and `StandardTestDispatcher` for deterministic async tests.
5. **Clean up after each test:** Close database and shutdown mock server in @After methods.

## Coverage

```bash
# Unit + integration tests
./gradlew testDebugUnitTest

# With coverage report
./gradlew testDebugUnitTest jacocoTestDebugUnitTestReport

# View HTML report
open app/build/reports/jacoco/jacocoTestDebugUnitTestReport/html/index.html
```

Target: 90%+ coverage.

## Running Tests

```bash
# All tests
./gradlew test

# Specific test class
./gradlew test --tests UserRepositoryTest

# Specific test method
./gradlew test --tests UserRepositoryTest.testFetchUser

# With verbose output
./gradlew test --info
```

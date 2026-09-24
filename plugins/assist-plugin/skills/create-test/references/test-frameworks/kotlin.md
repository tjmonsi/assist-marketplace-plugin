# Kotlin Testing: JUnit5 + Kotest

## Test Structure

Kotlin standard: `JUnit5` (widely compatible) or `Kotest` (more Kotlin-idiomatic).

### JUnit5 Style

```kotlin
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.BeforeEach
import kotlin.test.assertEquals
import myapp.process

class ProcessTest {
    // [AC-1 | SPEC-003 | FR-045] Happy path: valid input succeeds
    @Test
    fun `should process valid input`() {
        val result = process("valid")
        assertEquals("expected", result)
    }

    @Test
    fun `should reject empty input`() {
        assertThrows<InvalidInputException> {
            process("")
        }
    }

    @Test
    fun `should handle null input`() {
        assertThrows<NullPointerException> {
            process(null)
        }
    }
}
```

### Kotest Style (Spec-based, more readable)

```kotlin
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.kotest.assertions.throwables.shouldThrow
import myapp.process

class ProcessSpec : DescribeSpec({
    describe("process module") {
        // [AC-1 | SPEC-003 | FR-045]
        it("should process valid input") {
            val result = process("valid")
            result shouldBe "expected"
        }

        it("should reject empty input") {
            shouldThrow<InvalidInputException> {
                process("")
            }
        }
    }
})
```

## Naming Conventions

- JUnit5: `[action]_[scenario]` or `should[Action][Scenario]`
- Kotest: Use backtick strings for readability: `` `should process valid input` ``
- Descriptive: `testPaymentProcessWithValidCard` (good), `testProcess` (bad)

## Assertions

### Kotlin's `kotlin.test` (minimal dependency)

| Pattern | Usage |
|---------|-------|
| `assertEquals(expected, actual)` | Equality |
| `assertNotNull(value)` | Non-null |
| `assertNull(value)` | Null |
| `assertTrue(condition)` | Boolean |
| `assertFalse(condition)` | Boolean negation |

### JUnit5 APIs

| Pattern | Usage |
|---------|-------|
| `assertThrows<ExceptionType> { ... }` | Expect exception |
| `assertDoesNotThrow { ... }` | No exception |
| `assertEquals(expected, actual)` | Equality |

### Kotest Matchers (readable infix)

| Pattern | Usage |
|---------|-------|
| `result shouldBe "expected"` | Equality |
| `list shouldContain item` | Membership |
| `value shouldBeNull` / `shouldNotBeNull` | Null checks |
| `shouldThrow<ExceptionType> { ... }` | Expect exception |
| `{ ... } shouldNotThrow` | No exception |
| `string shouldMatch Regex(...)` | Regex |

## Parameterized Tests (Table-Driven)

### JUnit5 with @ParameterizedTest

```kotlin
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource

class PaymentProcessorTest {
    @ParameterizedTest(name = "{0}")
    @CsvSource(
        "valid: happy path, 50.0, true",
        "invalid: negative, -10.0, false",
        "boundary: zero, 0.0, true"
    )
    fun `payment processor`(name: String, amount: Double, shouldSucceed: Boolean) {
        if (shouldSucceed) {
            val result = processPayment(amount)
            assertNotNull(result)
        } else {
            assertThrows<Exception> {
                processPayment(amount)
            }
        }
    }
}
```

### Kotest with table tests

```kotlin
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.data.forAll
import io.kotest.data.row

class PaymentProcessorSpec : DescribeSpec({
    describe("payment processor") {
        it("handles various inputs") {
            forAll(
                row("valid: happy path", 50.0, true),
                row("invalid: negative", -10.0, false),
                row("boundary: zero", 0.0, true)
            ) { name, amount, shouldSucceed ->
                if (shouldSucceed) {
                    val result = processPayment(amount)
                    result shouldNotBe null
                } else {
                    shouldThrow<Exception> {
                        processPayment(amount)
                    }
                }
            }
        }
    }
})
```

## Fixtures and Setup

### JUnit5

```kotlin
class UserManagementTest {
    lateinit var user: User

    @BeforeEach
    fun setUp() {
        user = User(id = 1, email = "test@example.com", verified = true)
    }

    @AfterEach
    fun tearDown() {
        // Cleanup
    }

    @Test
    fun `should fetch user`() {
        assertEquals("test@example.com", user.email)
    }
}
```

### Kotest

```kotlin
class UserManagementSpec : DescribeSpec({
    val user = User(id = 1, email = "test@example.com", verified = true)

    beforeTest {
        // Setup per test
    }

    afterTest {
        // Cleanup per test
    }

    it("should fetch user") {
        user.email shouldBe "test@example.com"
    }
})
```

## Mocking

### Mockk (Kotlin-native)

```kotlin
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify

val mockGateway = mockk<PaymentGateway> {
    every { charge(any()) } returns "txn_123"
}

test("should charge with mock gateway") {
    val result = processPayment(50.0, mockGateway)
    verify { mockGateway.charge(50.0) }
    assertEquals("txn_123", result)
}
```

### Manual test double

```kotlin
class MockPaymentGateway : PaymentGateway {
    override fun charge(amount: Double): String {
        return if (amount < 0) throw IllegalArgumentException("negative")
        else "txn_123"
    }
}

test("with manual mock") {
    val result = processPayment(50.0, MockPaymentGateway())
    assertEquals("txn_123", result)
}
```

## Running Tests

```bash
# JUnit5 (via Gradle)
./gradlew test
./gradlew test --tests MyTest
./gradlew test --tests "*Payment*"

# Kotest (via Gradle)
./gradlew test

# With coverage (JaCoCo)
./gradlew jacocoTestReport
./gradlew test --info  # Verbose
```

## Best Practices

1. **File location:** `src/test/kotlin/[package]/[Class]Test.kt` or `Spec.kt`
2. **Use backtick test names in Kotest:** More readable, natural language
3. **Avoid implementation details:** Test public contracts only
4. **Parameterize:** Use table tests to avoid duplication
5. **Scope fixtures:** Use `BeforeEach`/`AfterEach` or Kotest's `beforeTest`/`afterTest`
6. **Descriptive errors:** Use assertion messages: `assertEquals(expected, actual, "User should be authenticated")`
7. **Mock only boundaries:** Database, HTTP, external services — not internal logic
8. **Null handling:** Kotlin's type system prevents nulls; test Optional/nullable types explicitly

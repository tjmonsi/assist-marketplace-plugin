# C++ Testing: Catch2 / GoogleTest

## Test Structure

`Catch2` (single-header, simpler syntax) or `GoogleTest/GTest` (more features, widely used).

### Catch2 Style

```cpp
#include <catch2/catch_all.hpp>
#include "mymodule.h"

// [AC-1 | SPEC-003 | FR-045] Happy path: valid input succeeds
TEST_CASE("process valid input") {
    auto result = process("valid");
    REQUIRE(result == "expected");
}

TEST_CASE("reject empty input") {
    REQUIRE_THROWS(process(""));
}

TEST_CASE("handle null input") {
    REQUIRE_THROWS(process(nullptr));
}
```

### GoogleTest Style

```cpp
#include <gtest/gtest.h>
#include "mymodule.h"

// [AC-1 | SPEC-003 | FR-045]
TEST(ProcessTest, ValidInputSucceeds) {
    auto result = process("valid");
    EXPECT_EQ(result, "expected");
}

TEST(ProcessTest, RejectEmptyInput) {
    EXPECT_THROW(process(""), InvalidInputException);
}

TEST(ProcessTest, HandleNullInput) {
    EXPECT_THROW(process(nullptr), std::runtime_error);
}
```

## Naming Conventions

- **Catch2:** `"descriptive test name as string"` — human-readable, spaces allowed
- **GoogleTest:** `TestSuiteName_TestCaseName` or `TestSuiteName::testCaseName` — CamelCase
- Descriptive: `PaymentProcessing_ValidCard_Succeeds` (good), `Test1` (bad)

## Assertions

### Catch2

| Pattern | Usage |
|---------|-------|
| `REQUIRE(condition)` | Assert (fatal) |
| `CHECK(condition)` | Assert (non-fatal) |
| `REQUIRE_EQ(expected, actual)` | Equality |
| `REQUIRE_NE(a, b)` | Inequality |
| `REQUIRE_THROWS(expr)` | Expect exception |
| `REQUIRE_THROWS_AS(expr, Type)` | Expect specific exception |
| `REQUIRE_THROWS_WITH(expr, match)` | Exception with message |

### GoogleTest

| Pattern | Usage |
|---------|-------|
| `EXPECT_EQ(expected, actual)` | Equality (non-fatal) |
| `ASSERT_EQ(expected, actual)` | Equality (fatal) |
| `EXPECT_NE(a, b)` | Inequality |
| `EXPECT_TRUE(condition)` | Boolean true |
| `EXPECT_FALSE(condition)` | Boolean false |
| `EXPECT_THROW(expr, Exception)` | Expect exception |
| `EXPECT_STREQ(str1, str2)` | String equality |

## Parameterized Tests (Table-Driven)

### Catch2 Sections

```cpp
TEST_CASE("payment processor") {
    SECTION("valid: happy path") {
        auto result = processPayment(50.0);
        REQUIRE(result.has_value());
    }

    SECTION("invalid: negative") {
        REQUIRE_THROWS(processPayment(-10.0));
    }

    SECTION("boundary: zero") {
        auto result = processPayment(0.0);
        // Check per spec: accept or reject
        REQUIRE(result.has_value());
    }

    SECTION("null-like: no card") {
        PaymentCard card;
        card.number = "";  // Simulate missing/null
        REQUIRE_THROWS(processPayment(50.0, card));
    }
}
```

### GoogleTest Parameterized Tests

```cpp
#include <gtest/gtest.h>

class PaymentProcessorTest : public ::testing::TestWithParam<std::tuple<std::string, double, bool>> {
};

INSTANTIATE_TEST_SUITE_P(
    PaymentCases,
    PaymentProcessorTest,
    ::testing::Values(
        std::make_tuple("valid: happy path", 50.0, true),
        std::make_tuple("invalid: negative", -10.0, false),
        std::make_tuple("boundary: zero", 0.0, true)
    )
);

TEST_P(PaymentProcessorTest, ProcessesCases) {
    auto [name, amount, should_succeed] = GetParam();
    
    if (should_succeed) {
        auto result = processPayment(amount);
        EXPECT_TRUE(result.has_value());
    } else {
        EXPECT_THROW(processPayment(amount), std::exception);
    }
}
```

## Fixtures (Setup/Teardown)

### Catch2

```cpp
TEST_CASE("user management", "[user]") {
    User user{1, "test@example.com", true};

    SECTION("fetch user") {
        REQUIRE(user.email == "test@example.com");
    }

    SECTION("verify status") {
        REQUIRE(user.verified == true);
    }
}
```

### GoogleTest

```cpp
class UserManagementTest : public ::testing::Test {
protected:
    void SetUp() override {
        user = User{1, "test@example.com", true};
    }

    void TearDown() override {
        // Cleanup
    }

    User user;
};

TEST_F(UserManagementTest, FetchesUser) {
    EXPECT_EQ(user.email, "test@example.com");
}
```

## Mocking with Google Mock (gmock)

```cpp
#include <gmock/gmock.h>
#include "payment.h"

class MockPaymentGateway : public PaymentGateway {
public:
    MOCK_METHOD(std::string, charge, (double amount), (override));
};

TEST(PaymentProcessTest, ChargesWithMockGateway) {
    MockPaymentGateway mockGateway;
    
    EXPECT_CALL(mockGateway, charge(50.0))
        .WillOnce(::testing::Return("txn_123"));
    
    auto result = processPayment(50.0, mockGateway);
    EXPECT_EQ(result, "txn_123");
}
```

## Running Tests

### Catch2

```bash
# Compile with test main
g++ -std=c++17 -o tests test.cpp mymodule.cpp

# Run all tests
./tests

# Run specific test
./tests "process valid input"

# List tests
./tests -l

# Verbose output
./tests -v
```

### GoogleTest

```bash
# Compile with gtest
g++ -std=c++17 -o tests test.cpp mymodule.cpp -lgtest -lpthread

# Run all tests
./tests

# Run specific test
./tests --gtest_filter="PaymentProcessTest.*"

# Verbose output
./tests --gtest_verbose

# Run parameterized cases only
./tests --gtest_filter="PaymentCases*"
```

## Best Practices

1. **File location:** `test/` or `tests/` subdirectory; `test_*.cpp` or `*_test.cpp`
2. **Header-only mocking:** Use interfaces (pure virtual) for easy mocking
3. **RAII for setup:** Use constructors/destructors to manage fixtures
4. **No memory leaks:** Use smart pointers (`std::unique_ptr`, `std::shared_ptr`) in test code
5. **Exception safety:** Tests should validate exception behavior (strong exception guarantee)
6. **Const-correctness:** Write tests that respect `const`
7. **Compare by value:** Avoid comparing pointers unless testing pointer semantics
8. **Descriptive assertions:** Use `EXPECT_*` over `assert()` for better reporting

## Compiler Flags for Test Builds

```cpp
// Add to CMakeLists.txt or build script
g++ -std=c++17 \
    -Wall -Wextra -Wpedantic \
    -fprofile-arcs -ftest-coverage \  // Coverage
    test.cpp mymodule.cpp \
    -o tests
```

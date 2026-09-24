# C++17+ Reference

## Contents
- Mandatory Toolchain
- Code Style Rules
- Type System Rules
- Prohibited Patterns
- Memory & Resource Management
- Required Configuration Files
- Project Structure

## Mandatory Toolchain

| Tool | Purpose | Prohibited alternatives |
|------|---------|------------------------|
| C++17 or C++20 | Language standard | < C++17 for new code |
| GCC 12+ / Clang 15+ / MSVC 19.3+ | Compiler | Older compilers lacking full standard support |
| CMake 3.20+ | Build system | Hand-written Makefiles for new projects |
| `vcpkg` or Conan | Package management | Manually vendored dependencies |
| `clang-format` | Format | Manual formatting |
| `clang-tidy` | Lint + static analysis | Skipping static analysis |
| GoogleTest or Catch2 | Testing | Hand-rolled assertion macros |
| `cppcheck` | Additional static analysis | None for new projects |

Gate: build with `-Wall -Wextra -Wpedantic -Werror` and a clean `clang-tidy` run before commit.

## Code Style Rules

- Naming: `PascalCase` for types/classes, `camelCase` or `snake_case` for functions/variables (pick one convention and apply it project-wide), `kMemberName` or `UPPER_SNAKE_CASE` for constants
- One class/struct per header where practical; keep headers minimal (forward-declare when possible)
- Use `#pragma once` or include guards on every header
- Prefer `<algorithm>` and range-based `for` over manual index loops
- Mark single-argument constructors `explicit` unless implicit conversion is intended
- Mark functions `const`, `noexcept`, `override`, and `final` wherever applicable
- Prefer `constexpr` / `consteval` over macros for compile-time constants
- Compiler warnings are errors: build with `-Wall -Wextra -Wpedantic -Werror` (or `/W4 /WX` on MSVC)

## Type System Rules

- Const-correctness everywhere: pass by `const&` for non-trivial types that are not mutated, mark methods `const` when they do not mutate state
- Use `auto` for local variable type deduction when the type is obvious from the initializer; spell out the type when it aids readability
- Prefer strongly-typed `enum class` over unscoped `enum` or raw integers
- Use `std::optional<T>` for values that may be absent instead of sentinel values or nullable raw pointers
- Use `std::variant<T...>` for closed sets of alternative types instead of unions or type-tagged structs
- Template constraints via `concept` / `requires` (C++20) instead of unconstrained templates or SFINAE tricks
- Implement or `= default` / `= delete` the rule of five (or rely on the rule of zero via RAII members) explicitly

## Prohibited Patterns

| Pattern | Fix |
|---------|-----|
| Raw `new` / `delete` | Use `std::unique_ptr` / `std::make_unique`, `std::shared_ptr` / `std::make_shared` |
| Raw owning pointers as class members | Use smart pointers; raw pointers only for non-owning observation |
| C-style casts `(Type)x` | Use `static_cast`, `dynamic_cast`, `const_cast`, `reinterpret_cast` explicitly |
| `NULL` or `0` for pointers | Use `nullptr` |
| `#define` for constants | Use `constexpr` |
| Manual `new[]` / `delete[]` arrays | Use `std::vector` or `std::array` |
| Passing large objects by value | Pass by `const&` (or by value + `std::move` when taking ownership) |
| Ignoring compiler warnings | Treat warnings as errors (`-Werror`) |
| `using namespace std;` in headers | Fully qualify, or scope-limit `using` to `.cpp` files |
| Catching `...` without rethrow/log | Log and rethrow, or handle a specific exception type |

## Memory & Resource Management

- RAII for every resource: file handles, locks, sockets, and memory are owned by an object whose destructor releases them
- `std::unique_ptr` is the default for exclusive ownership; `std::shared_ptr` only when shared ownership is a genuine requirement
- `std::lock_guard` / `std::unique_lock` / `std::scoped_lock` for mutexes — never manual `lock()` / `unlock()`
- Move semantics: mark move constructors/assignment `noexcept` so standard containers use them during reallocation instead of falling back to copy
- Use `std::move` only on objects you no longer need; never `std::move` a `const` object (it silently falls back to a copy)

## Required Configuration Files

| File | Purpose | Committed? |
|------|---------|------------|
| `CMakeLists.txt` | Build configuration, targets, compiler flags | Yes |
| `vcpkg.json` or `conanfile.txt` | Dependency manifest | Yes |
| `.clang-format` | Format rules | Yes |
| `.clang-tidy` | Static analysis rules | Yes |
| `CMakePresets.json` | Reproducible build/configure presets | Recommended |

## Project Structure

```
include/
  <project>/
    *.hpp                # Public headers
src/
  main.cpp               # Entry point
  *.cpp                  # Implementation files
tests/
  *_test.cpp             # GoogleTest/Catch2 test files
CMakeLists.txt
vcpkg.json
.clang-format
.clang-tidy
Dockerfile
```

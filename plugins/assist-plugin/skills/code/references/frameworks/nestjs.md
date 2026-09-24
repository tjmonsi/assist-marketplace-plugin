# NestJS Reference

## Contents
- Mandatory Toolchain
- Architecture (Modules, Providers, Controllers)
- Dependency Injection
- Decorators
- Pipes, Guards, Interceptors
- Exception Filters
- Middleware
- Structured Logging
- Testing Patterns
- Module Organization
- Project Structure

## Mandatory Toolchain

| Tool | Purpose | Prohibited alternatives |
|------|---------|------------------------|
| NestJS 10.x+ | Framework | Raw Express/Fastify without Nest for structured backend services |
| `class-validator` + `class-transformer` | DTO validation | Manual `if` validation in controllers |
| `@nestjs/config` | Typed env config | Direct `process.env` access scattered across files |
| Jest (default) | Testing | Vitest unless project already standardizes on it |
| `@nestjs/swagger` | OpenAPI generation | Hand-written API docs |

Language-level toolchain (TypeScript 5.x, `eslint`) is covered by the TypeScript language reference; this file covers NestJS-specific architecture only.

## Architecture (Modules, Providers, Controllers)

Nest organizes code into **modules**, each declaring **controllers** (handle HTTP/RPC input) and **providers** (services, repositories, factories — injectable business logic).

```typescript
// users.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],   // only export what other modules need
})
export class UsersModule {}

// users.controller.ts
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<UserResponseDto> {
    return this.usersService.findById(id)
  }
}

// users.service.ts
@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  async findById(id: number): Promise<UserResponseDto> {
    const user = await this.repo.findOneBy({ id })
    if (!user) throw new NotFoundException(`User ${id} not found`)
    return toUserResponseDto(user)
  }
}
```

Rules:
- Controllers stay thin: parse input (via DTOs + pipes), delegate to a service, return the result
- Business logic lives in providers (services), never in controllers
- Every module explicitly declares `imports`/`exports` — no relying on global providers except cross-cutting concerns (config, logging)

## Dependency Injection

- Constructor injection is the default and preferred style; avoid property injection except for optional circular-dependency cases
- Provider scope: `DEFAULT` (singleton, one instance app-wide) unless request-scoped state is required — request scope (`Scope.REQUEST`) has a real perf cost, use sparingly
- Use custom providers (`useClass`, `useValue`, `useFactory`) for swappable implementations (e.g., mock vs real payment gateway)

```typescript
@Injectable()
export class OrdersService {
  constructor(
    private readonly usersService: UsersService,
    @Inject('PAYMENT_GATEWAY') private readonly paymentGateway: PaymentGateway,
  ) {}
}

// module providers array
{
  provide: 'PAYMENT_GATEWAY',
  useFactory: (config: ConfigService) =>
    config.get('env') === 'production' ? new StripeGateway() : new MockGateway(),
  inject: [ConfigService],
}
```

- Circular dependencies between providers: use `forwardRef(() => OtherService)` only as a last resort; prefer restructuring modules to remove the cycle

## Decorators

| Decorator | Purpose |
|---|---|
| `@Module()` | Declare a module's controllers/providers/imports/exports |
| `@Injectable()` | Mark a class as a provider eligible for DI |
| `@Controller(prefix)` | Declare a route controller with a base path |
| `@Get()/@Post()/@Put()/@Delete()/@Patch()` | HTTP method + route binding |
| `@Param()/@Query()/@Body()/@Headers()` | Extract request data, combine with a pipe for validation |
| `@UseGuards()` | Attach guards to a route or controller |
| `@UseInterceptors()` | Attach interceptors to a route or controller |
| `@UsePipes()` | Attach validation/transformation pipes |
| `@UseFilters()` | Attach exception filters |
| `@Injectable() + @Catch()` | Combine to build custom exception filters |

Custom parameter decorators extract cross-cutting request data cleanly:

```typescript
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest()
    return request.user
  },
)

@Get('me')
getProfile(@CurrentUser() user: AuthUser): ProfileDto { ... }
```

## Pipes, Guards, Interceptors

**Pipes** — transform/validate input before it reaches the handler:

```typescript
@Post()
async create(@Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: CreateUserDto) {
  return this.usersService.create(dto)
}
```

Register `ValidationPipe` globally in `main.ts` instead of per-route when every DTO uses `class-validator`:

```typescript
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
```

**Guards** — authorization decisions, run before the route handler:

```typescript
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    return validateToken(request.headers.authorization)
  }
}

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {}
```

**Interceptors** — wrap handler execution (logging, response transformation, timeout, caching):

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now()
    return next.handle().pipe(
      tap(() => logger.info({ ms: Date.now() - start }, 'Request completed')),
    )
  }
}
```

Execution order for a request: Middleware → Guards → Interceptors (pre) → Pipes → Route Handler → Interceptors (post) → Exception Filters (on error).

## Exception Filters

Centralize error-to-HTTP-response mapping; never let unhandled errors leak stack traces to clients.

```typescript
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const status = exception.getStatus()
    logger.error({ status, message: exception.message }, 'Request failed')
    response.status(status).json({ statusCode: status, message: exception.message })
  }
}

app.useGlobalFilters(new HttpExceptionFilter())
```

- Use built-in `HttpException` subclasses (`NotFoundException`, `BadRequestException`, `ForbiddenException`) instead of throwing raw `Error`
- A catch-all filter (`@Catch()` with no argument) should log the full error and return a generic 500 — never expose internal error details in the response body

## Middleware

Express/Fastify-style middleware for cross-cutting request processing (before routing, guards, pipes):

```typescript
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    req.headers['x-request-id'] ??= randomUUID()
    next()
  }
}

// app.module.ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*')
  }
}
```

Register security middleware (`helmet`, `cors`) in `main.ts` at bootstrap, not as Nest middleware classes:

```typescript
const app = await NestFactory.create(AppModule)
app.use(helmet())
app.enableCors({ origin: allowedOrigins, credentials: true })
```

## Structured Logging

Replace Nest's default console logger with a structured logger (Pino) for production:

```typescript
import { LoggerModule } from 'nestjs-pino'

@Module({
  imports: [LoggerModule.forRoot({ pinoHttp: { level: process.env.LOG_LEVEL ?? 'info' } })],
})
export class AppModule {}

// injected in providers
constructor(@InjectPinoLogger(UsersService.name) private readonly logger: PinoLogger) {}
this.logger.info({ userId }, 'User created')
```

- Never use Nest's built-in `Logger` class in production services expecting JSON output — it produces human-formatted text by default
- Inject a per-class logger context (`PinoLogger` bound to the class name) so log lines are traceable to their source

## Testing Patterns

**Unit tests** — use `Test.createTestingModule` to build an isolated DI container with mocked providers:

```typescript
describe('UsersService', () => {
  let service: UsersService
  let repo: jest.Mocked<Repository<User>>

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: { findOneBy: jest.fn() } },
      ],
    }).compile()

    service = module.get(UsersService)
    repo = module.get(getRepositoryToken(User))
  })

  it('throws NotFoundException when user missing', async () => {
    repo.findOneBy.mockResolvedValue(null)
    await expect(service.findById(1)).rejects.toThrow(NotFoundException)
  })
})
```

**E2E tests** — bootstrap the full app with `Test.createTestingModule` + `createNestApplication()`, hit routes with `supertest`:

```typescript
const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
app = moduleRef.createNestApplication()
await app.init()

await request(app.getHttpServer()).get('/users/1').expect(200)
```

Rules:
- Mock at the provider boundary (repositories, external clients), not internal service methods
- E2E tests use a real (test) database or in-memory equivalent — never mock the DB layer in E2E suites

## Module Organization

- One feature module per bounded domain concept (`UsersModule`, `OrdersModule`, `PaymentsModule`)
- Shared, stateless utilities go in a `SharedModule` or `CommonModule` marked `@Global()` only when truly cross-cutting (config, logging) — avoid overusing `@Global()`
- Feature modules import only what they need from other feature modules' exported providers; no reaching into another module's internal providers
- `AppModule` composes root-level imports (feature modules, `ConfigModule.forRoot()`, `LoggerModule`) and holds no business logic itself

## Project Structure

```
src/
  main.ts                 # Bootstrap: NestFactory, global pipes/filters, helmet/cors
  app.module.ts            # Root module composition
  config/
    configuration.ts       # Typed config factory for @nestjs/config
  common/
    filters/
      http-exception.filter.ts
    interceptors/
      logging.interceptor.ts
    pipes/
      validation.pipe.ts
    guards/
      jwt-auth.guard.ts
    decorators/
      current-user.decorator.ts
  modules/
    users/
      users.module.ts
      users.controller.ts
      users.service.ts
      dto/
        create-user.dto.ts
        user-response.dto.ts
      entities/
        user.entity.ts
    orders/
      orders.module.ts
      orders.controller.ts
      orders.service.ts
test/
  users.e2e-spec.ts
  jest-e2e.json
tsconfig.json
nest-cli.json
Dockerfile
```

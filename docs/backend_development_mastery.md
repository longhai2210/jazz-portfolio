# 🚀 Backend Feature Development Mastery: Concepts, Architectures, and Patterns

This guide uses the Jazz Portfolio codebase to explain production-grade backend design patterns. These principles apply to any software development project, regardless of scale.

---

## 1. Modular Architecture & Dependency Injection (DI)

### The Core Concept
Many backend frameworks suffer from spaghetti dependencies, where files import from one another directly. This couples code and makes writing isolated tests difficult.

**NestJS** solves this with **Modular Encapsulation** and **Dependency Injection (DI)**:
- **Modules (`.module.ts`):** Act as boundaries. They declare which controllers handle requests, which providers (services) manage logic, and what dependencies are imported or exported.
- **Dependency Injection:** Classes request dependencies (like a database service) through their constructors. The framework instantiates and provides these dependencies at runtime.

```
+-------------------------------------------------------+
|                     MusicModule                       |
|                                                       |
|   +------------------+         +------------------+   |
|   | MusicController  |         |   MusicService   |   |
|   | (Routes/DTOs)    |-------->| (Business Logic) |   |
|   +------------------+         +--------+---------+   |
|                                         |             |
+-----------------------------------------|-------------+
                                          v
                                 +------------------+
                                 |  PrismaService   |
                                 |  (Database connection)
                                 +------------------+
```

### Best Practice Takeaway
Always declare dependencies as interfaces or constructor-injected classes. Never instantiate a dependency inside a service using the `new` keyword (e.g. `const db = new Database()`). This decouples your code and allows you to swap dependencies with mocks when writing unit tests.

---

## 2. Request Lifecycle: Guards, Interceptors, and Pipes

Every request to a NestJS application travels through a pipeline of middleware and filters before reaching your database.

```
Request ---> [Guards] ---> [Pipes (DTO Validation)] ---> [Controller] ---> [Interceptors] ---> Response
```

### 1. Guards (Authentication & Authorization)
Guards execute first. They inspect the request headers (e.g. check for a Bearer JWT token) and return a boolean. If `false`, the request is rejected with a `401 Unauthorized` response.
- **Example:** [jwt.strategy.ts](file:///d:/personal/apps/api/src/auth/strategies/jwt.strategy.ts) decodes incoming JWT tokens, verifying the user is authenticated.

### 2. Pipes (Request Data Validation)
Pipes validate incoming request payloads before they reach your controllers.
- **Data Transfer Objects (DTOs):** DTOs define the expected shape of incoming data. By decorating DTO properties with `class-validator` decorators, the request is automatically rejected if it contains invalid data:
  ```typescript
  export class CreateTrackDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    artist: string;
  }
  ```

### 3. Interceptors (Response Transformation)
Interceptors transform the response returned by a controller.
- **Global Success Wrapper:** Instead of controllers returning arbitrary payloads, a global interceptor wraps every successful response in a consistent format:
  ```json
  {
    "data": { ... }
  }
  ```

### 4. Exception Filters (Error Transformation)
If a database query fails or a service throws an error, a global exception filter intercepts it, formats the error message, and returns a consistent error response.

---

## 3. Secure File Upload Architecture: S3 Presigning

### The Problem
Traditional file upload pipelines send files from the client to the backend server, which then uploads them to S3. This consumes server memory and bandwidth, creating performance bottlenecks for large files (such as 50MB audio files).

### The Solution: Presigned URLs
We bypass the backend server by generating a secure **Presigned PUT URL** that allows the client to upload files directly to S3.

```
1. Client --------(Request Presigned URL)--------> 2. NestJS API (Validates auth, size & type)
3. Client <-------(Returns Upload URL)------------ 2. NestJS API
4. Client --------(PUTs File stream directly)----> 5. AWS S3 Storage
6. Client --------(Registers Metadata DTO)-------> 7. NestJS API (Saves S3 URL to Postgres)
```

### Key Implementation Details
1. **Validations:** The backend validates file sizes and mime-types before generating a presigned URL. This prevents users from uploading unauthorized file types (e.g. executable scripts) to your storage bucket.
2. **Metadata Logs:** The backend logs S3 object keys to the database, ensuring you maintain an inventory of uploaded assets.

---

## 4. Transaction Patterns: Category Reordering Logic

### The Concept
When reordering items in a list (e.g. dragging a playlist track to a new position), you must update the sort order of multiple records. If one update fails, the database can end up in an inconsistent state.

To prevent this, we execute these updates inside a database **Transaction**. If any query fails, the entire transaction is rolled back.

### Implementation Pattern (Prisma Transaction)
We use a Prisma transaction to fetch affected records, calculate the new sort order offsets, and commit the updates to the database:
```typescript
await this.prisma.$transaction(async (tx) => {
  // 1. Fetch current items in the category
  const items = await tx.categoryItem.findMany({
    where: { categoryId, isDeleted: false },
    orderBy: { sortOrder: 'asc' },
  });

  // 2. Adjust and map new sortOrder offsets
  const updates = items.map((item, index) => {
    return tx.categoryItem.update({
      where: { id: item.id },
      data: { sortOrder: index },
    });
  });

  // 3. Execute all updates simultaneously
  await Promise.all(updates);
});
```

---

## 5. Architectural takeaways for any project
1. **Define Strict Type Contracts:** Declare types in a shared package (e.g., `@jazz-portfolio/shared`) to enforce consistent typings across the frontend and backend.
2. **Fail Fast:** Validate request payloads using DTO validation pipes at the edge of your network layer before triggering business logic.
3. **Database Constraints over Code:** Use foreign keys, unique indices, and database-level checks to guarantee data integrity rather than relying on application code.
4. **Decouple Media Storage:** Use presigned URLs for client-side uploads to keep your application servers lightweight.

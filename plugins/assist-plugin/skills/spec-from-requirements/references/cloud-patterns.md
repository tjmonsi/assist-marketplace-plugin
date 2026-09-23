# Cloud Patterns — GCP and AWS Architecture Reference

When-to-use guidance and key configuration for cloud services across GCP and AWS. This is a selection reference, not a setup tutorial: it covers selection criteria and architectural trade-offs for the **Architecture** and **General** spec templates.

## Contents

1. [Cloud provider decision](#cloud-provider-decision)
2. [Cloud boundary rules](#cloud-boundary-rules)
3. [Compute](#compute)
4. [Databases](#databases)
5. [Caching](#caching)
6. [Messaging and events](#messaging-and-events)
7. [Storage](#storage)
8. [Networking](#networking)
9. [AI and ML](#ai-and-ml)
10. [CI/CD and container registry](#cicd-and-container-registry)
11. [Identity and security](#identity-and-security)
12. [Monitoring and logging](#monitoring-and-logging)
13. [Firebase](#firebase)
14. [Architecture patterns](#architecture-patterns)

---

## Cloud provider decision

| Scenario | Approach |
|---|---|
| **Single cloud (GCP only)** | Use only GCP services from this reference. Do not introduce AWS components. |
| **Single cloud (AWS only)** | Use only AWS services from this reference. Do not introduce GCP components. |
| **Multi-cloud** | Select each component based on which cloud is best for that specific job. Consider what triggers it, what uses it, and what consumes its output. The component that triggers or consumes a service's output belongs in the same cloud, to avoid cross-cloud latency and egress costs. |

## Cloud boundary rules

1. **Keep trigger, processor, and consumer in the same cloud.** If a Pub/Sub topic triggers a Cloud Function that writes to Firestore, all three stay in GCP.
2. **Cross-cloud only at explicit integration boundaries.** API calls, webhook callbacks, or shared data stores (for example a CDN-fronted S3 bucket consumed by a GCP service over HTTP).
3. **Never split a transaction across clouds.** If a write must be atomic, every participant is in the same cloud.
4. **Prefer managed connectors over custom bridges.** GCP's BigQuery S3 connector over a hand-built Lambda-to-Pub/Sub pipe.
5. **Document the cloud boundary explicitly** in the spec's Cloud boundaries table: which components are in which cloud, and why.

---

## Compute

### GCP

| Service | Use when | Key config |
|---|---|---|
| Cloud Run | Containerized HTTP services needing auto-scale to zero; request-driven workloads; internal or external APIs | Port 8080, min/max instances, concurrency (default 80), CPU allocation (request-scoped or always-on), region, VPC connector for private resources |
| Cloud Functions v2 | Event-driven processing (Pub/Sub, Cloud Storage, Firestore triggers); lightweight transformations; webhook handlers | Runtime (Node 20, Python 3.12, Go 1.22, Java 21), memory (128 MB to 32 GB), timeout (up to 60 min for v2), trigger type, retry policy, ingress settings |
| Compute Engine | Bastion hosts for VPC access; long-running VMs; workloads requiring a specific OS or hardware (GPUs); lift-and-shift migrations | Machine type (e2/n2/c3), network tags, SSH keys, startup script, preemptible or spot for cost savings, persistent disk type (pd-ssd, pd-balanced) |
| GKE Autopilot | Multi-container microservices; teams already on Kubernetes; workloads needing pod-level scaling and scheduling | Pod resource requests (no node management), namespace isolation, Workload Identity, release channel |
| GKE Standard | Fine-grained node control; GPU node pools; custom machine types; DaemonSets or privileged pods | Node pool config, machine type, auto-scaling range, node taints and labels, maintenance windows |

### AWS

| Service | Use when | Key config |
|---|---|---|
| Lambda | Event-driven (SQS, S3, API Gateway, EventBridge, DynamoDB Streams); sub-15-minute execution; pay-per-invocation economics | Runtime, memory (128 MB to 10 GB), timeout (max 15 min), handler, layers, VPC config for private resources, reserved concurrency |
| Fargate | Containerized services without managing EC2; long-running containers; sidecar patterns | Task definition (CPU/memory), VPC subnets, security groups, service auto-scaling, load balancer target group |
| ECS on EC2 | Container workloads needing GPU, a custom AMI, or placement constraints | EC2 instance type, capacity provider, task placement strategy, auto-scaling group |
| EC2 | Bastion hosts; custom workloads; persistent stateful services; GPU-heavy ML training | Instance type (t3/m6i/c7g), security groups, key pair, EBS volume type (gp3/io2), placement group, spot for cost savings |
| EKS | Multi-container microservices on Kubernetes; hybrid or multi-cloud strategy | Node group config, Fargate profiles, IRSA (IAM Roles for Service Accounts), managed add-ons |
| App Runner | Simple containerized web apps; minimal config; no Kubernetes expertise on the team | Source (ECR image or code repo), CPU/memory, auto-scaling config, custom domain |

### Decision: Cloud Run vs Lambda vs Fargate

- **Cloud Run / Fargate:** containers, longer execution, HTTP-centric workloads.
- **Cloud Functions / Lambda:** event-driven glue, short-lived, triggered by other services.
- **GKE / EKS:** when you need the Kubernetes ecosystem, complex scheduling, or multi-container pods.

---

## Databases

### GCP

| Service | Use when | Key config |
|---|---|---|
| Cloud SQL (PostgreSQL) | Relational data, ACID transactions, complex joins, moderate scale (up to roughly 64 TB) | Instance tier (db-custom or predefined), SSD storage, automated backups, regional high availability, read replicas, private IP via VPC |
| AlloyDB | High-performance PostgreSQL-compatible; mixed transactional and analytical workloads; columnar engine needed for analytics | Cluster config, primary instance (CPU/memory), read pool instances, columnar engine (auto-enabled), cross-region replication |
| Firestore (Native mode) | Document database with real-time sync; mobile and web apps; serverless scaling; hierarchical data | Collection and document structure, composite indexes, security rules, offline persistence, multi-region or regional |
| Firestore (Datastore mode) | Server-side document DB; batch processing; no real-time listeners needed | Entity kinds, properties, composite indexes, namespace isolation |
| Cloud Spanner | Globally distributed relational DB; five-nines availability; horizontal write scaling | Instance config (regional or multi-region), processing units, interleaved tables, commit timestamps |
| BigQuery | Analytics, data warehousing, large-scale SQL, in-database ML (BQML) | Dataset location, table partitioning (time, ingestion, range), clustering columns, slot reservations (on-demand or flat-rate), materialized views |
| Bigtable | High-throughput key-value; time-series data; IoT streams; datasets over 1 TB | Cluster nodes, storage type (SSD/HDD), row key design (avoid hotspotting), column families, replication |

### AWS

| Service | Use when | Key config |
|---|---|---|
| RDS (PostgreSQL/MySQL) | Relational data, ACID transactions, moderate scale | Instance class (db.r6g/db.m6g), Multi-AZ deployment, storage type (gp3/io2), automated backups, read replicas, parameter groups |
| Aurora (PostgreSQL/MySQL) | High-performance relational; auto-scaling storage; read-heavy workloads | Instance class, Aurora Serverless v2 (ACU range), global database for cross-region, reader endpoint |
| DynamoDB | Key-value or document, serverless, single-digit ms latency at any scale | Partition key, sort key, GSI/LSI, on-demand or provisioned capacity, TTL, DynamoDB Streams, point-in-time recovery |
| DocumentDB | MongoDB-compatible document DB; migrating off MongoDB | Instance class, cluster config, replica instances, TLS enforcement |
| Redshift | Data warehouse; complex analytical queries; Spectrum for querying S3 | Node type (ra3), cluster size, Redshift Serverless (RPU), distribution and sort keys, materialized views |
| Neptune | Graph database; social networks; knowledge graphs; fraud detection | Instance class (db.r6g), cluster endpoints, Gremlin or SPARQL |
| Timestream | Time-series data; IoT metrics; DevOps monitoring | Memory store retention, magnetic store retention, dimensions, measures |

### Decision: Firestore vs DynamoDB

- **Firestore:** real-time listeners, offline sync, Firebase integration, hierarchical documents, generous free tier for small apps.
- **DynamoDB:** higher throughput ceiling, predictable pricing at scale, DAX for microsecond caching, better for server-side-only workloads.

---

## Caching

### GCP

| Service | Use when | Key config |
|---|---|---|
| Memorystore (Redis) | Session cache, API response cache, rate limiting, leaderboards, in-region pub/sub | Tier (basic has no replication, standard is HA), memory size, Redis version (7.x), AUTH, VPC network, maintenance window |
| Memorystore (Valkey) | Redis-compatible workloads; open-source licensing preferred; new deployments | Same config surface as Redis; Valkey 7.2+; check whether Redis-specific modules are needed |
| Memorystore (Memcached) | Simple key-value caching; multi-threaded read-heavy workloads; no persistence needed | Node count, vCPU per node, memory per node |

### AWS

| Service | Use when | Key config |
|---|---|---|
| ElastiCache (Redis OSS) | Session cache, API response cache, pub/sub, sorted sets, complex data structures | Node type (cache.r7g), cluster mode (enabled above 250 nodes), replication groups, encryption at rest and in transit |
| ElastiCache (Valkey) | Same as Redis OSS with open-source licensing; AWS recommends it for new deployments | Same config as Redis OSS |
| ElastiCache (Memcached) | Simple caching; multi-threaded; no persistence | Node type, number of nodes, auto-discovery |
| DAX (DynamoDB Accelerator) | Microsecond reads on DynamoDB tables; read-heavy DynamoDB workloads | Node type (dax.r5), cluster size, subnet group, TTL (item cache, query cache) |

### Caching strategy guidance

- **Cache-aside:** the application checks the cache first, loads from the DB on a miss, then writes to the cache. Most common.
- **Write-through:** write to cache and DB together. Good for read-heavy data with frequent writes.
- **TTL discipline:** set TTLs from staleness tolerance. API responses 30s to 5min, sessions 30min to 24h, reference data 1h to 24h.

---

## Messaging and events

### GCP

| Service | Use when | Key config |
|---|---|---|
| Pub/Sub | Async messaging, event streaming, fan-out to multiple subscribers, at-least-once delivery | Topic, subscription (pull or push), ack deadline (10s to 600s), dead-letter topic, message retention (default 7d), ordering key, filtering |
| Cloud Tasks | Deferred HTTP task execution; rate-limited dispatch to a target; retries with backoff | Queue config, rate limits (dispatches/sec, concurrent dispatches), retry config (max attempts, min/max backoff), target (HTTP or App Engine) |
| Eventarc | Route events from 130+ Google sources to Cloud Run, Functions, or Workflows | Trigger (Cloud Audit Logs, direct Pub/Sub, third-party), destination, event filters |
| Cloud Scheduler | Cron-based job scheduling; trigger Pub/Sub, HTTP, or App Engine at intervals | Cron expression (unix-cron), target type, timezone, retry config |

### AWS

| Service | Use when | Key config |
|---|---|---|
| SQS (Standard) | Decoupling producers and consumers; at-least-once delivery; high throughput | Visibility timeout, message retention (1min to 14d), dead-letter queue (maxReceiveCount), long polling (WaitTimeSeconds) |
| SQS (FIFO) | Strict ordering; exactly-once processing; deduplication | Message group ID, deduplication ID (content-based or explicit), throughput (300 msg/s, or 3000 with batching and high-throughput mode) |
| SNS | Fan-out to multiple subscribers (SQS, Lambda, HTTP, email); pub/sub pattern | Topic (Standard or FIFO), subscription protocol, filter policy, dead-letter queue, message attributes |
| EventBridge | Event bus routing by rules; cross-account; SaaS integrations; scheduled rules | Event bus (default or custom), rules with event patterns, targets (Lambda, SQS, Step Functions), schema registry |
| Step Functions | Orchestrating multi-step workflows; state machines; human-in-the-loop approvals | State machine definition (ASL), Standard or Express, task states, error handling (Retry/Catch) |

### Decision: Pub/Sub vs SQS plus SNS

- **Pub/Sub:** one service for both queuing and fan-out. Simpler, scales automatically, best for GCP-native systems.
- **SQS:** point-to-point queue. Combine with SNS for fan-out (SNS to SQS). More granular control over visibility and retry.
- **EventBridge vs Pub/Sub filtering:** EventBridge has richer content-based filtering. Pub/Sub filtering is simpler but less expressive.

---

## Storage

### GCP

| Service | Use when | Key config |
|---|---|---|
| Cloud Storage (Standard) | Frequently accessed objects; serving static assets; application data | Bucket location (region, dual-region, multi-region), uniform bucket-level access, object versioning, lifecycle rules, CORS, signed URLs (v4, expiry) |
| Cloud Storage (Nearline) | Data accessed less than once per month; backups | 30-day minimum storage, retrieval cost, lifecycle transition from Standard |
| Cloud Storage (Coldline) | Data accessed less than once per quarter; disaster recovery | 90-day minimum storage, lower storage cost, higher retrieval cost |
| Cloud Storage (Archive) | Data accessed less than once per year; compliance archives | 365-day minimum storage, lowest storage cost, highest retrieval cost |
| Filestore | NFS file shares; shared storage for GKE or Compute Engine | Tier (Basic HDD/SSD, Enterprise), capacity, VPC network, access mode |

### AWS

| Service | Use when | Key config |
|---|---|---|
| S3 Standard | Frequently accessed objects; static hosting; application data | Bucket region, versioning, lifecycle rules, bucket policy, CORS, presigned URLs (default expiry 3600s), server-side encryption (SSE-S3 or SSE-KMS) |
| S3 Intelligent-Tiering | Unknown or changing access patterns; automatic cost optimization | No retrieval fees, per-object monitoring fee, auto-transitions between frequent, infrequent, and archive tiers |
| S3 Glacier | Long-term archives; compliance; retrieval in minutes to hours | Storage class (Instant, Flexible, Deep Archive), retrieval tier (expedited, standard, bulk) |
| EFS | NFS file shares for EC2 or EKS; shared persistent storage | Performance mode (general or maxIO), throughput mode (bursting, provisioned, elastic), lifecycle policy |
| EBS | Block storage for EC2 instances; database volumes | Volume type (gp3/io2/st1), IOPS, throughput, snapshots, encryption |

### Signed URL pattern

Both clouds use signed URLs for temporary access to private objects.

- **GCP:** `gcloud storage sign-url`, or generate via a service account key or IAM signBlob. V4 signatures recommended. Maximum expiry 7 days.
- **AWS:** `aws s3 presign` or SDK `getSignedUrl`. Default expiry 3600s; maximum depends on credential type (IAM user 7 days, STS 36 hours).

---

## Networking

### GCP

| Service | Use when | Key config |
|---|---|---|
| VPC | Network isolation; private connectivity for Cloud SQL, Memorystore, GKE | Subnets (regional), firewall rules, Private Google Access, VPC peering, Shared VPC for multi-project |
| Cloud Load Balancing (External HTTP/S) | Public web traffic; global anycast; SSL termination; CDN integration | Backend service (Cloud Run NEG, instance group, GKE NEG), URL map, managed SSL certificate, CDN policy |
| Cloud Load Balancing (Internal HTTP/S) | Service-to-service traffic within a VPC; internal APIs | Internal managed backend, internal forwarding rule, proxy subnet |
| Cloud Load Balancing (TCP/UDP) | Non-HTTP traffic; database proxying; game servers | Network endpoint group or instance group, health checks, forwarding rule |
| Serverless VPC Access | Cloud Run or Cloud Functions reaching private VPC resources (Cloud SQL, Memorystore) | Connector (subnet or IP range), min/max instances, machine type (e2-micro for low traffic, e2-standard-4 for high) |
| Cloud NAT | Outbound internet from private VPC resources without external IPs | Router, NAT config, minimum ports per VM, log config |
| Cloud VPN | Site-to-site VPN; connecting on-prem to GCP | HA VPN (two tunnels), peer gateway, Cloud Router with BGP, shared secret |
| Cloud Interconnect | High-bandwidth low-latency on-prem connectivity; above 2 Gbps | Dedicated (10/100 Gbps) or Partner Interconnect, VLAN attachment |

### AWS

| Service | Use when | Key config |
|---|---|---|
| VPC | Network isolation; public and private subnet architecture | CIDR block, subnets per AZ, route tables, internet gateway, NAT gateway, security groups, NACLs |
| ALB (Application Load Balancer) | HTTP/HTTPS traffic; path-based routing; WebSocket; gRPC | Target groups (instance, IP, Lambda), listener rules, ACM certificate, health checks, WAF integration |
| NLB (Network Load Balancer) | TCP/UDP traffic; ultra-low latency; static IP; TLS passthrough | Target groups, cross-zone load balancing, static Elastic IP per AZ |
| API Gateway (REST) | RESTful APIs with throttling, caching, API keys, request validation | Stage, usage plan, API key, authorizer (Lambda or Cognito), caching, WAF |
| API Gateway (HTTP) | Simpler HTTP APIs; lower latency and cost than REST; JWT authorizers | Routes, integrations (Lambda, HTTP backends), JWT authorizer, CORS |
| VPN Gateway | Site-to-site VPN; connecting on-prem to AWS | Customer gateway, VPN connection (two tunnels), BGP or static routing |
| Direct Connect | High-bandwidth low-latency on-prem connectivity | Connection (1/10/100 Gbps), virtual interface (private, public, transit) |
| Transit Gateway | Hub-and-spoke multi-VPC connectivity; centralized routing | Attachments (VPC, VPN, Direct Connect), route tables, peering |

### Bastion host pattern

Both clouds use a bastion (jump host) for secure access to private resources.

- Deploy a small instance (GCP e2-micro, AWS t3.micro) in a public subnet.
- Restrict SSH (port 22) via firewall or security group to known IPs only.
- Reach private resources (Cloud SQL, RDS, Memorystore, ElastiCache) through an SSH tunnel.
- **Prefer managed alternatives:** GCP IAP TCP tunneling, AWS SSM Session Manager. No bastion, no open inbound ports.

---

## AI and ML

### GCP

| Service | Use when | Key config |
|---|---|---|
| Vertex AI (Gemini API) | LLM inference; text generation; multimodal (text, image, video); embeddings | Model (gemini-2.0-flash, gemini-2.5-pro), temperature, max tokens, safety settings, system instruction, grounding with Google Search |
| Vertex AI (Custom Training) | Training custom ML models; fine-tuning; hyperparameter tuning | Training job config, machine type (n1-standard with GPU), container image, training data in GCS, model registry |
| Vertex AI (Predictions) | Serving custom or AutoML models; online or batch prediction | Endpoint, traffic split, machine type, min/max replicas, model monitoring |
| Vertex AI Agent Builder | RAG applications; search over enterprise data; grounded generation | Data store (structured, unstructured, website), search or agent app, chunk size, embedding model |
| Dialogflow CX | Conversational agents; complex multi-turn flows; IVR systems | Agent, flows, pages, intents, entity types, webhooks, environments |
| Document AI | Extracting structured data from documents (invoices, receipts, forms) | Processor type (OCR, form parser, custom), processor version, batch processing |
| Natural Language API | Sentiment analysis; entity extraction; syntax analysis | Features (sentiment, entities, syntax, classification), document type, encoding |
| Translation API | Text translation; glossaries for domain-specific terms | Source and target language, model (NMT or AutoML), glossary, batch translation for large volumes |

### AWS

| Service | Use when | Key config |
|---|---|---|
| Bedrock | Managed LLM inference; multiple model providers; RAG with Knowledge Bases | Model ID, inference parameters, Knowledge Base (S3 data source, embedding model, vector store), Guardrails |
| SageMaker | Custom ML training and hosting; notebook experimentation; MLOps pipelines | Instance type (ml.p4d for training, ml.g5 for inference), training job, endpoint config, model registry, SageMaker Pipelines |
| Comprehend | NLP: sentiment, entities, key phrases, language detection, PII detection | Analysis type, language, custom classifier or entity recognizer, batch jobs |
| Textract | OCR; form and table extraction from documents | Feature type (TABLES, FORMS, QUERIES), async for large documents, S3 input and output |
| Rekognition | Image and video analysis; face detection; object detection; content moderation | Detection type, confidence threshold, collection for face matching |
| Transcribe | Speech-to-text, real-time or batch; custom vocabulary | Language, media format, custom vocabulary, streaming or batch, speaker identification |
| Polly | Text-to-speech; multiple voices and languages | Voice ID, output format (mp3, ogg, pcm), engine (neural or standard), SSML support |

### Decision: Vertex AI Agent Builder vs Bedrock Knowledge Bases

- **Vertex AI Agent Builder:** deeper Google Search grounding; native Firestore and BigQuery data stores; complex agent workflows.
- **Bedrock Knowledge Bases:** multi-model flexibility; simpler RAG setup; native S3 ingestion; OpenSearch, Pinecone, or Aurora vector stores.

---

## CI/CD and container registry

### GCP

| Service | Use when | Key config |
|---|---|---|
| Cloud Build | CI/CD pipelines; building container images; deploying to Cloud Run, GKE, or Functions | cloudbuild.yaml, build steps (builder images), substitutions, triggers (push, PR, manual), service account, private worker pool for VPC access |
| Artifact Registry | Container images; language packages (npm, Maven, Python); Helm charts | Repository type, location, cleanup policies, vulnerability scanning, IAM for pull and push |
| Cloud Deploy | Continuous delivery to GKE or Cloud Run with approval gates and rollback | Delivery pipeline, targets (dev, staging, prod), skaffold.yaml, promotion sequence, required approval, canary or rolling strategy |

### AWS

| Service | Use when | Key config |
|---|---|---|
| CodeBuild | CI: building artifacts, running tests, building container images | buildspec.yml, compute type, environment image, environment variables, VPC config |
| CodePipeline | Orchestrating CI/CD stages (source, build, deploy); approval gates | Source (CodeCommit, GitHub, S3), build (CodeBuild), deploy (ECS, Lambda, S3, CloudFormation), manual approval action |
| ECR | Container image registry; vulnerability scanning | Repository, lifecycle policy (image count or age), scan on push, encryption, cross-account access |
| CodeDeploy | Deploying to EC2, ECS, or Lambda with blue-green or rolling strategies | Application, deployment group, deployment config (AllAtOnce, HalfAtATime, canary), appspec.yml, rollback config |

### Container build pattern

```
Source (git push) -> Build (Cloud Build / CodeBuild) -> Push image (Artifact Registry / ECR) -> Deploy (Cloud Run / Fargate)
```

- Tag images with the git SHA for traceability.
- Use multi-stage Dockerfiles to keep images small.
- Enable vulnerability scanning on push.
- Use Workload Identity or IRSA for CI service accounts, never long-lived keys.

---

## Identity and security

### GCP

| Service | Use when | Key config |
|---|---|---|
| IAM | Access control for all GCP resources; least privilege | Roles (predefined or custom), bindings (member, role, resource), conditions, organization policies |
| Service Accounts | Identity for applications and services; workload identity | SA email, key management (prefer Workload Identity Federation over keys), IAM bindings, impersonation |
| Workload Identity Federation | Authenticate external workloads (GitHub Actions, AWS, Azure, Kubernetes) without SA keys | Identity pool, provider (OIDC, SAML, AWS), attribute mapping, attribute conditions |
| Secret Manager | API keys, DB passwords, certificates | Secret, versions, rotation schedule, IAM access (secretAccessor), replication policy |
| Cloud KMS | Encryption key management; envelope encryption; signing | Key ring, crypto key, key version, purpose, rotation period, IAM (encrypter, decrypter) |
| Cloud Armor | WAF and DDoS protection for external load balancers | Security policy, rules (IP allowlist or denylist, rate limiting, preconfigured OWASP rules), adaptive protection |
| VPC Service Controls | Restricting data exfiltration; isolating services inside a perimeter | Service perimeter, access levels, ingress and egress rules, restricted services |

### AWS

| Service | Use when | Key config |
|---|---|---|
| IAM | Access control; users, groups, roles, policies | Managed or inline policies, trust relationships, permission boundaries, SCPs for Organizations, MFA enforcement |
| IAM Roles (for services) | Identity for Lambda, ECS tasks, EC2 instances | Trust policy (service principal), attached policies, session duration, IRSA for EKS |
| Secrets Manager | API keys, DB passwords, certificates; automatic rotation | Secret, rotation Lambda, rotation schedule, resource policy, cross-account access |
| SSM Parameter Store | Configuration values; less sensitive parameters; hierarchical paths | Parameter type (String, SecureString, StringList), path hierarchy, KMS key for SecureString, versioning |
| KMS | Encryption key management; envelope encryption | Customer-managed key, key policy, alias, annual automatic rotation, grants |
| WAF | Web application firewall for ALB, API Gateway, CloudFront | Web ACL, managed and custom rule groups, rate limiting, IP sets, regex pattern sets |
| Cognito | User authentication for web and mobile; OAuth2/OIDC; social login | User pool, app client, hosted UI, identity pool, MFA, custom Lambda triggers |

### Secrets management pattern

- **Never** store secrets in plain-text environment variables, source code, or container images.
- Use Secret Manager (GCP) or Secrets Manager (AWS) as the source of truth.
- Mount secrets at runtime: Cloud Run `--set-secrets`, Lambda Secrets Manager extension, ECS secrets in the task definition.
- Rotate on a schedule. Both clouds support automatic rotation.

---

## Monitoring and logging

### GCP

| Service | Use when | Key config |
|---|---|---|
| Cloud Logging | Centralized logs from all GCP services; log-based metrics; audit logs | Log sinks (BigQuery, Cloud Storage, Pub/Sub), log router, exclusion filters, retention (default 30 days), log views |
| Cloud Monitoring | Metrics, dashboards, alerting for GCP resources and custom metrics | Alerting policies (condition, notification channel), uptime checks, custom metrics, dashboard widgets, SLOs |
| Cloud Trace | Distributed tracing; latency analysis across services | Auto-instrumented for Cloud Run and Functions, OpenTelemetry integration, trace sampling rate |
| Cloud Profiler | CPU and memory profiling in production | Agent-based (Go, Java, Node.js, Python), continuous profiling, flame graphs |
| Error Reporting | Aggregating and tracking application errors | Auto-detected from Cloud Logging, error grouping, notification on new errors, resolution status |

### AWS

| Service | Use when | Key config |
|---|---|---|
| CloudWatch Logs | Centralized logs; log groups per service; log-based metrics and alarms | Log group, retention (1 day to 10 years), metric filters, subscription filters, Logs Insights queries |
| CloudWatch Metrics | Infrastructure and custom metrics; dashboards; alarms | Namespace, dimensions, statistics (Avg, Max, p99), alarm (threshold, period, evaluation periods, actions), composite alarms |
| X-Ray | Distributed tracing; service map; latency analysis | Sampling rules, X-Ray SDK or OpenTelemetry, trace groups, insights |
| CloudWatch Synthetics | Canary monitoring; endpoint availability; visual monitoring | Canary script (Node.js or Python), schedule, S3 bucket for artifacts, alarm on failure |

### Structured logging pattern

- Emit JSON logs with consistent fields: `severity`, `message`, `trace_id`, `span_id`, `labels`.
- GCP Cloud Logging auto-parses JSON from stdout on Cloud Run and Cloud Functions.
- AWS CloudWatch Logs supports structured JSON queries via Logs Insights.
- Include correlation IDs across services so traces stitch end to end.

---

## Firebase

### Hosting, Auth, and Firestore integration

| Service | Use when | Key config |
|---|---|---|
| Firebase Hosting | Static sites; SPA hosting with CDN; SSR via Cloud Functions or Cloud Run | firebase.json (rewrites, redirects, headers), deploy target, preview channels, custom domain, CDN cache headers |
| Firebase Auth | User authentication (email/password, social, phone); integrates with Firestore security rules | Providers, custom claims, multi-tenancy, blocking functions |
| Firestore Security Rules | Client-side access control for Firestore; replaces backend auth middleware for direct client access | rules-version 2, match statements, `request.auth`, `resource.data`, `get()`/`exists()` for cross-document checks |
| Firebase Functions | Backend logic triggered by Firebase events (Auth, Firestore, Storage); HTTPS callable functions | Region (match the Firestore region), runtime, memory, timeout, onCall vs onRequest |

### SSR with Firebase Hosting

When using Firebase Hosting for server-side rendering (Next.js, Angular Universal, SvelteKit):

- Configure `rewrites` in `firebase.json` to route to a Cloud Function or Cloud Run backend.
- **Region alignment is critical.** The Cloud Function backing SSR must sit in the same region as Firebase Hosting's configured region; a mismatch adds latency.
- For Next.js, use the Firebase-aware adapter or deploy to Cloud Run with a rewrite rule.
- Cache SSR responses with `Cache-Control` headers; the Firebase Hosting CDN respects them.

### Firebase and GCP project relationship

- Every Firebase project is a GCP project. Firebase services are GCP services with a Firebase-specific SDK and console.
- Firestore collections created via the Firebase SDK are the same collections GCP client libraries access.
- Cloud Functions deployed via the Firebase CLI are Cloud Functions v2 (gen2) by default.

---

## Architecture patterns

### Serverless API

```
Client -> Cloud Run / Lambda -> Cloud SQL / DynamoDB -> Memorystore / ElastiCache
```

- **When:** standard web or mobile API; predictable request/response pattern; auto-scaling needed.
- **GCP:** Cloud Run, Cloud SQL (PostgreSQL), Memorystore (Redis). Serverless VPC Access for private DB connectivity.
- **AWS:** Lambda, API Gateway (HTTP API), RDS or DynamoDB, ElastiCache. VPC config on Lambda when reaching RDS.
- **Key consideration:** cold starts. Cloud Run keeps instances warm with min-instances above 0; Lambda uses provisioned concurrency.

### Event-driven processing

```
Event source -> Pub/Sub / SQS -> Cloud Functions / Lambda -> Database / Storage
```

- **When:** async processing; decoupled producers and consumers; retry and dead-letter needed.
- **GCP:** Pub/Sub to Cloud Functions v2 (push subscription) or Cloud Run (pull). Dead-letter topic for failures.
- **AWS:** SQS to Lambda (event source mapping), or SNS to SQS to Lambda for fan-out. Dead-letter queue with maxReceiveCount.
- **Key consideration:** idempotency. At-least-once delivery means the consumer must tolerate duplicates.

### Bastion access to private databases

```
Developer -> SSH -> Bastion (public subnet) -> Cloud SQL / RDS (private subnet)
```

- **When:** connecting database tools (psql, pgAdmin) to private databases for debugging or migration.
- **GCP:** Compute Engine e2-micro with IAP TCP tunneling (preferred), or a public IP with a firewall rule. Connect to the Cloud SQL private IP.
- **AWS:** EC2 t3.micro with SSM Session Manager (preferred), or a public IP with a security group. Connect to RDS in the private subnet.
- **Key consideration:** prefer managed alternatives (IAP, SSM) so there is no bastion instance or SSH key to manage.

### Static plus SSR hybrid

```
Client -> CDN (Firebase Hosting / CloudFront) -> Static assets (cached)
                                              -> SSR (Cloud Functions / Lambda@Edge / Cloud Run)
```

- **When:** marketing pages plus a dynamic app; SEO-critical pages need SSR; static assets need a global CDN.
- **GCP:** Firebase Hosting with rewrites to Cloud Run or Cloud Functions. CDN caching for static, pass-through for dynamic.
- **AWS:** S3 and CloudFront for static. Lambda@Edge or CloudFront Functions for edge SSR, or ALB and Fargate for an SSR origin.
- **Key consideration:** cache strategy. Static assets get a long TTL with cache-busting filenames; SSR pages get a short TTL (30s to 5min) or stale-while-revalidate.

### Multi-tier with VPC isolation

```
Internet -> External LB -> Frontend (Cloud Run / Fargate, public subnet)
                        -> Internal LB -> Backend API (Cloud Run / Fargate, private subnet)
                                       -> Database (Cloud SQL / RDS, private subnet)
                                       -> Cache (Memorystore / ElastiCache, private subnet)
```

- **When:** defense in depth; backend services must not be internet-accessible; compliance requirements.
- **GCP:** External HTTPS LB to Cloud Run (ingress all), Internal HTTPS LB to Cloud Run (ingress internal), Cloud SQL private IP plus Memorystore.
- **AWS:** internet-facing ALB to Fargate in public subnets, internal ALB to Fargate in private subnets, RDS and ElastiCache in private subnets.
- **Key consideration:** service-to-service authentication. Use IAM-based auth (GCP IAM invoker role; AWS IAM auth on ALB or mutual TLS).

# Security

## Implemented prototype controls

- bcrypt password hashes and short-lived JWT access tokens;
- refresh-token type and secret separation;
- RBAC guard primitives and tests;
- request validation with unknown-field rejection;
- rate limiting, Helmet headers and web CSP;
- upload size and MIME allow-list;
- safe filenames and SHA-256 checksums;
- no `eval`, no provider-generated JavaScript, no raw HTML renderer;
- structured content validation and registered animation templates;
- student content lookup rejects non-`PUBLISHED` status;
- approve/publish transitions retain review history;
- secrets excluded from source ZIP;
- synthetic learner data only.

## Production requirements

Put FastAPI on a private network, rotate secrets with a managed vault, enforce TLS, add malware scanning and object storage, persist refresh-token rotation/revocation, enable database audit retention, configure production CSP without development allowances, complete child-data privacy/consent review and perform penetration/accessibility testing.

Document extractors must not execute macros, embedded objects or uploaded code. Python exercises require a separately isolated sandbox before arbitrary code execution is ever offered.

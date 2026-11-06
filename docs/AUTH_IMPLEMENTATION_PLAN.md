# Authentication and roles implementation plan

## Findings
The initial krisha commit provides bcrypt passwords, cookie sessions, Rutgers-domain registration, and role middleware. Feed/detail APIs and UI currently require login. Admin provisioning and management UI are missing. Student seeds reset passwords explicitly and preserve existing state. The task PDF was subsequently reviewed: it calls for five student seeds and one admin, role middleware, session handling, suspension checks, and acceptance tests. Five students are now seeded. Its earlier CAS/passwordless-login direction is superseded by the current branch and user request for password login. Kunal retains ownership of the flag queue and hiding suspended sellers’ listings.

## Permission model
| Capability | Viewer (no account) | Student | Admin |
| --- | --- | --- | --- |
| Browse/search/filter and read rules | Yes | Yes | Yes |
| Read active/sold listing details | Yes | Yes | Yes |
| Post listings and message | No | Yes | Yes |
| Edit/moderate any listing | No | No | Yes |
| List accounts and suspend/restore students | No | No | Yes |
| Publish rules | No | No | Yes |

Viewer is absence of authentication, not a stored role. Registration always creates students. Admin provisioning is CLI-only; no role elevation endpoint. Admin accounts cannot be suspended through the management API. Removed listings are available only through admin management. Suspension is checked against the database on every protected request and disconnects live sockets.

## Implementation sequence
1. Share password policy and session creation; provide separate admin username login and safe repeatable admin seed.
2. Open only public reads; retain authenticated write/photo/chat endpoints.
3. Add bounded, paginated admin reads and allowlisted updates; reuse listing validation. Add persistent public rules and admin editor.
4. Reuse login form for student/admin modes; add role gate, dashboard, public rules and guest links.
5. Verify seeded logins, negative permissions, suspension, invalid updates, public visibility, lint and production build.

## Boundaries
Preserve existing photo ownership and messaging behavior. Keep Kunal’s flag/review queue and Santanu’s profile/favorites work separate. No email verification/password-reset provider is configured. Admin password is supplied via environment, never committed or embedded in browser code. Seed preview is read-only; apply is explicit. Existing admin credentials are preserved unless a reset is explicitly requested.

# Raazi Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Owner-Only Access**: Every case (`/cases/{caseId}`), clue (`/cases/{caseId}/clues/{clueId}`), and message (`/cases/{caseId}/messages/{messageId}`) strictly belongs to `ownerId == request.auth.uid` verified with `request.auth.token.email_verified == true`.
2. **PII Isolation**: User email is isolated in `/users/{userId}/private/info`, strictly readable and writable only by `request.auth.uid == userId`.
3. **Immutable Ownership & Temporal Integrity**: `ownerId`, `caseId`, and `createdAt` cannot be modified after creation. All `createdAt` and `updatedAt` fields must equal `request.time`.
4. **Terminal Case Locking**: Once a `DetectiveCase` transitions to `status == 'solved'` or `'closed'`, subsequent client updates to suspects, clues, or status are denied.
5. **Bounded Arrays & Strings**: Every string enforces explicit `.size()` bounds and IDs match `^[a-zA-Z0-9_\-]+$`. `suspects` <= 8 items; `connectedNodeIds` <= 12 items.

## 2. The "Dirty Dozen" Adversarial Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read/list on `/cases` (`request.auth == null`).
2. Unverified email write (`request.auth.token.email_verified == false`) attempting to create `/cases/{caseId}`.
3. Identity spoofing: creating `/cases/{caseId}` with `ownerId != request.auth.uid`.
4. Shadow field injection: creating `/cases/{caseId}` with extra field `isAdmin: true`.
5. Timestamp spoofing: creating `/cases/{caseId}` with client-supplied `createdAt` instead of `request.time`.
6. Path ID poisoning: creating `/cases/invalid..id!@#` violating `^[a-zA-Z0-9_\-]+$`.
7. Resource exhaustion: creating a clue with `detail` exceeding 1200 characters or `connectedNodeIds.size() > 12`.
8. Cross-user subcollection write: user B writing to `/cases/{caseOwnedByA}/clues/{clueId}`.
9. Orphaned subcollection create: writing a clue where `incoming().caseId != caseId` or parent case does not exist.
10. Post-terminal mutation: updating `/cases/{caseId}` when `existing().status == 'solved'`.
11. Ownership hijacking: updating `ownerId` on an existing `/cases/{caseId}` document.
12. PII snooping: user B reading `/users/{userA}/private/info`.

# Chunk: chunk-01-auth-initiation

- [x] T-010: Create `src/lib/portal/auth-state.ts` for host-aware auth-state signing and verification.
- [x] T-011: Create `src/lib/portal/auth-routing.ts` for `redirectUri`, completion-path, and host-aware sign-out routing helpers.
- [x] T-012: Update `src/routes/sign-in.tsx` and `src/routes/sign-up.tsx` to use the new helpers without changing `buildSignInRedirect` callers.

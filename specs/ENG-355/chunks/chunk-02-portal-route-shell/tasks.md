# Chunk: chunk-02-portal-route-shell

- [x] T-020: Create `src/routes/portal.tsx` with `beforeLoad: guardRouteAccess("micPortal")`.
- [x] T-021: Gate the protected shell with Convex `Authenticated` and `AuthLoading` before rendering route content.
- [x] T-022: Keep the placeholder shell query-free and active-portal-context-aware.
- [x] T-023: Add route/component coverage proving AuthLoading does not mount protected content and authorized users render the shell.

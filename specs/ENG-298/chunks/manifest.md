# Chunk Manifest: ENG-298 - Broker portal: make WorkOS sign-in, callback, and logout host-aware

| Chunk | Tasks | Status | Notes |
| ----- | ----- | ------ | ----- |
| chunk-01-auth-initiation | T-010, T-011, T-012 | complete | host-aware state/routing helpers plus sign-in/sign-up updates |
| chunk-02-auth-completion | T-020, T-021, T-022 | complete | post-auth completion, wrong-portal rejection, and callback flow wiring |
| chunk-03-sign-out-and-e2e | T-030, T-031, T-032 | complete | host-aware sign-out plus localhost/`*.localhost` auth helper parameterization |
| chunk-04-validation-and-audit | T-900, T-910, T-920 | in-progress | spec audit recorded; remaining blockers are repo-wide `bun check` failures and CodeRabbit review scope/tooling |

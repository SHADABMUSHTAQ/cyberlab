# CyberLab v12 — Beginner-first physical networking beta

This release focuses on the first three labs and fixes the main usability failure in v11: learners entered a module without knowing what to do next.

The lab now keeps three guidance layers synchronized: the Byte guide, a persistent DO THIS NOW banner, and visual pulsing on the exact physical target. Cabling has explicit in-progress state and cancellation, device/port inspection is interactive, terminal command chips execute directly, and failure messages explain the missing action.

The networking engine now evaluates subnets using the configured masks rather than assuming every network is /24.

The full modular source remains the expansion base. `LIVE_BETA_V12.html` is a self-contained deployable build for the current beta.

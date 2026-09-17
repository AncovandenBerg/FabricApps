// Identity of the dedicated seed account for reference data (Scenario,
// ScenarioOption). Rayfin has no custom roles or service keys, so write
// access is granted through a row-level policy comparing claims.email to
// this literal. The email is not a secret (it is baked into the generated
// DAB config); the account password is, and would live only in an
// environment variable read by whatever runs the seed.
//
// Part of the schema contract only: this repo has no backend, so nothing
// here is built or executed. See README.md in this folder.
export const SEED_USER_EMAIL = 'seed@capacity-command.local';

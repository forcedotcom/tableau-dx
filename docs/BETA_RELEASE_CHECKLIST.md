# Beta Release Checklist

Status tracker for publishing Salesforce Semantic DX as an Open Beta extension
to the VS Code Marketplace and Open VSX Registry.

Based on: [Salesforce Extension Pack: Beta Extension Requirements](https://salesforce.quip.com/NpKmA7tcpVFo#JNWABAnibXx)

---

## Publishing Requirements

- [x] Publish workflow for VS Code Marketplace (`.github/workflows/publishVSCode.yml`)
- [x] Publish workflow for Open VSX Registry (`.github/workflows/publishOpenVSX.yml`)
- [x] Published under Salesforce publisher (`"publisher": "salesforce"` in package.json)
- [x] Extension marked as "Preview" (`"preview": true` in package.json)

## Marketing Requirements

- [ ] Marketplace branding icon — coordinate with PMM, add `"icon"` field to package.json
- [x] Extension title finalized — `"Salesforce Semantic DX"`

## Legal Requirements

- [ ] PLR (Product Legal Request) filed and Non-GA Product Legal Intake Questionnaire completed
- [ ] T&Cs added to marketplace listing (from Legal)
- [ ] T&Cs included in the open source repository
- [ ] Confirmed user does not need to actively accept T&Cs before accessing Beta functionality

## Functional Requirements

- [x] Plugs into SF auth flow via `salesforcedx-vscode-core` dependency
- [x] Plugs into SF telemetry flow via `@salesforce/vscode-service-provider`

## Technical Requirements

- [x] Extension calls libraries, not Salesforce CLI commands (note: `src/utils/git.ts` spawns `git` for local git operations — not Salesforce CLI, should be fine)
- [x] Copyright notices in all source files (added to all 51 `.ts` files)
- [x] License notices in all source files (SPDX identifier in headers)
- [x] License text in root directory (`LICENSE.txt` — BSD-3-Clause)

## Governance Requirements

- [x] GitHub Issues enabled for bug reporting

## GitHub Infrastructure

- [ ] **Shared secrets** — Request org admin to grant `forcedotcom/tableau-dx` access to:
  - `VSCE_PERSONAL_ACCESS_TOKEN` (VS Code Marketplace publishing)
  - `IDEE_OVSX_PAT` (Open VSX Registry publishing)
  - Contact: Mitch Spano or Gordon Bockus, or the support contact you've been working with
- [ ] **`publish` environment** — Create at: https://github.com/forcedotcom/tableau-dx/settings/environments
  - Name: `publish` (must match workflow files exactly)
  - Recommended: add required reviewers as a deployment protection rule

## Currently Available Org Secrets (for reference)

These are already accessible but are not the publish secrets:
- `CLI_ALERTS_SLACK_WEBHOOK`
- `SF_CHANGE_CASE_CONFIGURATION_ITEM`
- `SF_CHANGE_CASE_TEMPLATE_ID`

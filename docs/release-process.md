# Release, Versioning, and Tagging Automation

This repository automates version tagging and GitHub releases with two workflows located in `.github/workflows`.

## Version and Tag Workflow

* **File**: `.github/workflows/version-and-tag.yml`
* **Trigger**: Pushes to `main` that change any `package.json` in `frontend/`, `frontend/chat-ui/`, or `backend/`.
* **Behavior**:
  * Reads the canonical version from `frontend/package.json`, validates that it follows semantic versioning (`x.y.z` with optional `-prerelease` or `+build` qualifiers), and ensures the versions in the other `package.json` files match.
  * If the tag `v<version>` does not already exist, it creates an annotated tag and pushes it to the repository using the GitHub Actions bot identity.
  * Summaries are written to the workflow run to make the outcome visible.

Keep the versions in the three `package.json` files synchronized so that the automation can validate them successfully. Update the version before merging to `main` to trigger a new tag.

## Release Workflow

* **File**: `.github/workflows/create-release.yml`
* **Trigger**: Pushes of tags that match the pattern `v*.*.*` (for example, `v1.2.3`).
* **Behavior**:
  * Checks out the repository at the tagged commit.
  * Uses [`softprops/action-gh-release`](https://github.com/softprops/action-gh-release) to publish a GitHub release named after the tag with automatically generated release notes.

With both workflows enabled, updating the version on `main` creates a corresponding Git tag, and pushing that tag automatically publishes a release with generated notes.

## GitHub Tag Rulesets

If the repository uses [tag rulesets](https://docs.github.com/en/repositories/releasing-projects-on-github/viewing-your-repositorys-releases-and-tags#about-tags) to control who can create or update release tags, ensure that the ruleset allows the `github-actions` bot (or whichever GitHub App/token triggers the workflow) to push tags that start with `v`. Without an allow rule, the automated job will fail when attempting to create `v*.*.*` tags. Repository administrators can manage these settings under **Settings → Rules → Tag rules**.

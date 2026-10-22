# Contributing

Thank you for contributing. This project is part of the Network Theory
Applied Research Institute (NTARI) and is governed by a simple, deliberately
unamendable arrangement.

## Licensing: inbound = outbound, no CLA

- Contributions are accepted under a **Developer Certificate of Origin (DCO)**
  sign-off. See the `DCO` file at the repository root.
- **Your contribution is licensed under this project's existing license**
  (the AGPL-3.0 text in `LICENSE`). Inbound matches outbound. There is no
  separate contributor agreement to sign.
- **Copyright stays with you.** NTARI requires no CLA and takes no copyright
  assignment. The copyright in this project therefore remains distributed
  across every contributor, and no single party — including NTARI — can
  relicense the corpus without unanimous consent. That distribution is the
  point: it entrenches the project's anti-enclosure commitment in the
  ownership structure itself.

## How to sign off

Configure your git identity to match your GitHub account, once:

```sh
git config --global user.name  "Your Name"
git config --global user.email "you@example.org"
```

Then sign off every commit by adding `-s`:

```sh
git commit -s -m "Your message"
```

This appends a `Signed-off-by: Your Name <you@example.org>` trailer, which is
your certification of the DCO for that commit.

## If you forget the sign-off

A DCO check runs on every pull request. If a commit is missing its
`Signed-off-by` trailer the check will fail; it may also post a comment on
your pull request explaining which commits need attention (comments are posted
only on pull requests opened from a branch in this repository, not from forks).
Either way, the failed check's details list exactly which commits need a
sign-off. To fix:

- **One commit:**
  ```sh
  git commit --amend --no-edit --signoff
  git push --force-with-lease
  ```
- **Several commits** (the last N):
  ```sh
  git rebase --signoff HEAD~N
  git push --force-with-lease
  ```

Open your pull request against the `main` branch; branch from
`main` to start work.

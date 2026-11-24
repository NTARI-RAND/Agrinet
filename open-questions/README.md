# Open questions

This folder holds the questions about Agrinet that have not been answered yet. Each question is one Markdown file. Together, the files are the repository's list of open questions. The list is kept up to date.

## What it is for

Building software leaves questions as well as answers. A design choice may not be made yet, a behaviour may be untested, two documents may disagree, or a question may need the maintainers or NTARI's board to decide it. Writing the question down keeps it from being lost. Then the next contributor can work on it.

NTARI keeps a list like this in each of its repositories. The practice comes from the Janus Facing Architecture (JFA), which asks every JFA project to keep one and keep it up to date (see the [concept triage](https://github.com/NTARI-RAND/Janus/blob/main/jfa-concept-triage-2026-08-24.md) and [Janus's own list](https://github.com/NTARI-RAND/Janus/blob/main/OPEN-QUESTIONS.md)). A question leaves the list only when it is resolved, or when the people who live with the outcome make an explicit decision about it. If this list is out of date, the repository no longer tells the truth about what is known. Check this folder whenever you send a pull request.

A question about the JFA standard itself goes in [Janus's list](https://github.com/NTARI-RAND/Janus/blob/main/OPEN-QUESTIONS.md). A research question about this layer goes in the open-questions folder of [economy-information-rand](https://github.com/NTARI-RAND/economy-information-rand). A question about this repository's own code, documents or decisions goes here.

Known gaps are also listed in [CONFORMANCE.md](../CONFORMANCE.md), under Stand-ins and open residuals. Leave them there. If a gap needs research or a decision, add a question file here, and link each to the other.

## Adding a question

1. Check that the question is not already listed. Look in this folder and in the other lists named above. If it is in this folder, add what you found to that file, under **What was checked**, with your name and the date. If it is listed somewhere else, add what you found there instead.
2. Create a new file in this folder. Name it with a few words from the question, using only lowercase letters a to z, digits and hyphens. For example, the question "Who approves a release?" becomes `who-approves-a-release.md`.
3. Copy the template below into the file, and fill in every heading.
4. Send the file in a pull request. Every commit needs a DCO sign-off: commit with `git commit -s`, which adds a `Signed-off-by` line with your name and email. If you use the GitHub website instead, GitHub adds this line for you when you commit.

Write in plain English. This repository is public, and deleting a file later does not remove it from the history. Never include passwords, API keys or other secrets. Apart from your own name, never include anything that identifies a person: a member's name, username or account ID, the IP address or location of someone's machine, home addresses, personal phone numbers or emails, handwritten signatures, dates of birth, personal ID numbers (such as passport numbers), bank details or donor names. Use made-up test data instead.

## Template

```markdown
# The question, in one sentence

**Status:** open

**Asked by:** your name, YYYY-MM-DD

## Why it matters

One or two sentences: what depends on the answer.

## What was checked

Each source you checked and what it showed, with its link, such as a file,
an issue, a pull request or a document. For a file on GitHub, link to a
fixed commit, not to a branch, so the link still shows what you saw. Also
say what you looked for and did not find.

## Constraints inherited

The rules any answer must respect, such as the JFA's Lines That Cannot Be
Crossed, bylaws sections, governance registry entries, laws, or this
project's own earlier decisions.
Write "None known" if there are none.

## Who might answer

For example: the people who maintain this repository, NTARI's board, or a specialist.

## Resolution

Leave this empty while the question is open.
```

## When a question is answered

Update its file in a pull request. Set **Status** to `resolved (YYYY-MM-DD)`, and write the answer under **Resolution**, with its evidence and links. Keep the file. The list keeps its history.

A question can also leave the list without an answer. This needs an explicit decision by the people who live with the outcome, such as the people who maintain this repository or NTARI's board. The person who asked the question cannot close it alone. Set **Status** to `closed (YYYY-MM-DD)`. Under **Resolution**, write who decided, what they decided and why, with a link to where the decision is recorded.

## Opening a question again

No answer is closed for good. Under bylaws §2.3, any member may bring a decided matter back. To reopen a question, send a pull request that sets **Status** back to `open`. Move the old **Resolution** text under **What was checked**, with its date, so the history stays. Then add the new facts, with your name and the date.

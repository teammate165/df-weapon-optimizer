# df_weapon_optimizer

This project analyzes the Delta Force video game and aims to build an attachment optimizer. The initial generator objective is to minimize perceived in-game recoil.

## Repository and data

- Upstream reference: [AVA-2568/delta-gun-tierlist](https://github.com/AVA-2568/delta-gun-tierlist).
- Before investigating the upstream repository, consult the [repository map](https://chatgpt.com/library?file_id=libfile_dd227bbd7bd0819181a2e1f5322ac78b&account_id=personal). Keep a local copy as `docs/delta_gun_tierlist_repo_map.md` for Codex sessions. Verify the specific paths needed against the checked-out revision.
- Existing [SQLite dataset](https://chatgpt.com/library?file_id=libfile_7d6782785f20819195d5ca52207099ea&account_id=personal), with separate source exports for [weapons](https://chatgpt.com/library?file_id=libfile_8a94fbbcf19c8191bad3bc126b46629e&account_id=personal), [parts](https://chatgpt.com/library?file_id=libfile_f55330409df481919b2e4000d945ffb0&account_id=personal), and [mechanisms](https://chatgpt.com/library?file_id=libfile_478aab13fa1c81919219b607bbe90bac&account_id=personal). Download the files needed for a task into the local project if Codex cannot access those links.

## Research and implementation backlog

The persistent project todo list is [TODO.md](TODO.md). Read it at the start of project work and keep it updated as work progresses. Preserve requirements and link evidence or output files when recording progress. Mark items complete only when their validation requirements are met. Local issue files may break down this backlog; keep their status consistent with TODO.md.

Use repository paths, data identifiers, game versions, and reproducible in-game tests to support findings. Mark unverified interpretations as hypotheses.

## Agent skills

### Issue tracker

Local Markdown issues under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `GLOSSARY.md` and `docs/adr/`. See `docs/agents/domain.md`.

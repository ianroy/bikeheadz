# Incidents

A public log of production incidents that affected users — root cause
and fix, written so the next on-call can recognise the same symptom.

> **No incidents on record.** v0.1.34 is the first release where the
> end-to-end pipeline shipped to production, so there is no public
> incident history yet. The structure below is what an entry will look
> like once we have one to publish.

When this page does have entries, the most recent will appear at the
top, and we'll link the corresponding worker logs and the resulting
playbook updates so the lessons learned aren't lost in chat history.

---

## Entry structure

Every published incident uses the same five-field shape so they can be
diffed across each other:

- **Date** — when the customer impact started (UTC).
- **Duration / impact** — minutes affected; what the user saw; how
  many users were affected.
- **Root cause** — single-sentence summary plus a link to the
  underlying issue (worker log line, playbook section, deploy SHA).
- **Fix** — what we changed, and the commit / release tag that
  shipped it.
- **Prevention** — the alert, test, or doc update that should keep
  this from re-happening.

### Example (template; not a real incident)

- **Date.** 2026-MM-DD, 14:00–14:42 UTC.
- **Duration / impact.** 42 minutes; affected users saw
  `runpod_no_result (last_status=COMPLETED)` after generation; ~30 sessions.
- **Root cause.** Aggregate POST from the RunPod worker exceeded the
  per-request size cap because `return_aggregate_stream` was set to
  `True` in a hand-edit during a hotfix
  ([`docs/RUNPOD_TRELLIS_PLAYBOOK.md` §4](RUNPOD_TRELLIS_PLAYBOOK.md#4-return_aggregate_stream-false-by-default)).
- **Fix.** Reverted to `False`, bumped `HANDLER_VERSION`, redeployed
  via `gh release create`.
- **Prevention.** Added a test that asserts the handler module
  registers with `return_aggregate_stream=False`; updated the
  playbook checklist for hotfixes.

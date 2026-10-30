#!/usr/bin/env python3
"""Stop hook (owner 2026-10-29): a session in the chain (marker <git-dir>/aeterna-chain, written by session_gate.sh lock/manual)
may not end its turn while "Mode rantai" is ON. Every Stop is logged to <git-dir>/aeterna-stop-log.jsonl.
Allowed stops: no marker (owner Q&A chat), chain switch OFF, background tasks still running, or MAX_BLOCKS blocks in a row
(each within BLOCK_WINDOW s of the previous one) with an unchanged HEAD (stuck loop: the stop is allowed and logged). Gate/git errors fail closed (block) except on a missing git dir.
Env overrides for tests: AETERNA_CHAIN_STATUS_CMD (prints the `rantai status` line), AETERNA_STOP_MAX_BLOCKS, AETERNA_STOP_WINDOW."""
import json, os, subprocess, sys, time

MAX_BLOCKS = int(os.environ.get("AETERNA_STOP_MAX_BLOCKS", "8"))
# Blocks only count as "a stuck loop" when they follow each other quickly: a block more than this many seconds after the previous one
# means the session did real work in between (a long Lane K bundle without a commit), so the count restarts.
BLOCK_WINDOW = int(os.environ.get("AETERNA_STOP_WINDOW", "600"))


def run(cmd, cwd):
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=45)
        return r.returncode, (r.stdout or "").strip()
    except Exception as e:  # timeout, missing bash
        return 99, str(e)


def main():
    try:
        ev = json.load(sys.stdin)
    except Exception:
        ev = {}
    root = os.environ.get("CLAUDE_PROJECT_DIR") or ev.get("cwd") or os.getcwd()
    rc, gd = run(["git", "rev-parse", "--absolute-git-dir"], root)
    if rc != 0 or not gd:
        return 0
    marker, logf, state = (os.path.join(gd, n) for n in ("aeterna-chain", "aeterna-stop-log.jsonl", "aeterna-stop-state.json"))
    _, head = run(["git", "rev-parse", "HEAD"], root)
    chain = os.path.exists(marker)
    bg = ev.get("background_tasks") or []
    last = (ev.get("last_assistant_message") or "")[-300:]
    verdict, why = "allow", "no chain marker"
    if chain:
        sc = os.environ.get("AETERNA_CHAIN_STATUS_CMD")
        rc, out = run(["bash", "-c", sc] if sc else ["bash", "tools/session_gate.sh", "rantai", "status"], root)
        try:
            st = json.load(open(state))
        except Exception:
            st = {}
        fresh = st.get("head") == head and time.time() - st.get("t", 0) <= BLOCK_WINDOW
        n = st.get("n", 0) + 1 if fresh else 1
        if rc == 0 and "Mode rantai: OFF" in out:
            verdict, why = "allow", "chain switch OFF"
        elif bg:
            verdict, why = "allow", "background tasks running"
        elif n > MAX_BLOCKS:
            verdict, why = "allow", f"stuck: {MAX_BLOCKS} blocks in a row without a new commit"
        else:
            verdict = "block"
            why = "chain ON" if rc == 0 else f"gate error rc={rc} (fail closed)"
        try:
            json.dump({"head": head, "n": n if verdict == "block" else 0, "t": time.time()}, open(state, "w"))
        except Exception:
            pass
    try:
        with open(logf, "a") as f:
            f.write(json.dumps({"t": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "verdict": verdict, "why": why, "head": head[:9],
                                "chain": chain, "stop_hook_active": ev.get("stop_hook_active"), "last": last}) + "\n")
    except Exception:
        pass
    if verdict == "block":
        sys.stderr.write(
            "Chain mode (rantai) is ON and this session is in the chain: do not end the turn. Take the next roadmap item now "
            "(Lane K: next pack bundle; after a release run `bash tools/session_gate.sh done ...` then `bash tools/session_gate.sh rantai next`; "
            "continue on GO). To stop on purpose the owner posts `rantai off` (or `bash tools/session_gate.sh rantai off`). "
            "Answering the owner is fine, but keep working afterwards. Stop log: .git/aeterna-stop-log.jsonl\n")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())

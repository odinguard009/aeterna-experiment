#!/usr/bin/env bash
# Session gate + auto-mode switch for Aeterna (owner, 2026-10-16: "idle chain").
# Rules: docs/ai/next-session-prompt.md. All state lives in comments on issue #1 (first word of the first line):
#   ON / OFF [reason]   auto-mode switch; newest one wins; none yet = OFF
#   LOCK                a scheduled (auto) session started; released by DONE or UNLOCK; stale after STALE_H hours
#   MANUAL              a manual "Lanjutkan roadmap" session started; released by DONE or UNLOCK; stale after MANUAL_H hours
#   DONE vX.Y.Z         a session (manual or auto) finished and sent the game file; ends every session
#   UNLOCK [lane]       a session stopped early (error, quota, ~80 calls); with a lane it ends only that lane
#   RANTAI ON / RANTAI OFF [reason]  chain-mode switch (owner, 2026-10-20); newest one wins; none yet = OFF
#   DONE ... tokens=N [sub=M] [rantai]  tokens = the session's budget-counter difference plus its subagents' tokens (sub=, owner
#                       2026-10-21); "rantai" = it was a chain continuation
#                       (item T: "lock|manual ... budget=<start>" + "done ... budget=<end>" lets the gate compute tokens=; explicit tokens= still wins)
#   HEMAT ON / HEMAT OFF  token-saving switch (owner, 2026-10-19); newest one wins; none yet = ON. ON = the pre-v0.68 session
#                       (single main session, read-only subagents only as CLAUDE.md "Mode hemat" says); OFF = team session (v0.68)
# A lane word on LOCK/MANUAL/UNLOCK (ui | card) is still read by the evaluator (parallel lanes were removed in v0.96.0; nothing writes it any more).
#   any other text      owner activity: restarts the idle timer, like a new session
# Commands (no clone needed for check/on/off/status/switch):
#   gh api repos/odinguard009/aeterna-experiment/contents/tools/session_gate.sh --jq .content | base64 -d | bash -s <command>
#   check opus|sonnet  scheduled runs, BEFORE the clone: prints "GO" or "STOP <reason>" (exit 0 either way; exit 1 = gate error, treat as STOP).
#                    Owner 2026-10-17: every session runs on Opus, so only "check opus" can GO (the Sonnet task is disabled).
#   check opus [lane]  with a lane only sessions of that lane (or without a lane) count as "running"
#   lock [lane]      scheduled run after the clone: LOCK, exit 3 when another session is active (in that lane)
#   manual [lane]    manual session after session_start.sh: MANUAL, exit 3 when an auto session holds the lock (in that lane)
#   done vX.Y.Z next=Opus|Sonnet   end of every session (manual and auto); next= is the model the next roadmap item needs
#   unlock [lane]    early stop / error of any session (of that lane)
#   on | off [why]   owner switch ("otomatis on" / "otomatis off" in chat, a comment on issue #1, or the Actions workflow "Auto mode")
#   switch           prints ON or OFF (cheap; auto sessions run it between tasks)
#   hemat [on|off|status]  token-saving switch ("hemat on" / "hemat off" / "hemat status" in chat); prints "Mode hemat: ON|OFF";
#                    every session reads it at the start (team or not) and prints it in the final summary
#   status           one-line summary for the owner ("otomatis status")
#   rantai [on|off|status|next]  chain mode ("rantai on" / "rantai off" / "rantai status" in chat). next = end of every
#                    session, after done: prints "GO ..." (start the next session in the same chat; its DONE carries "rantai")
#                    or "STOP <reason>"; one session over RANTAI_MAX tokens turns the switch OFF (comment "RANTAI OFF auto: ...")
#   busy [lane]      exit 3 when a LOCK or MANUAL session is active (in that lane; used by session_start.sh)
# Offline test: GATE_FIXTURE=1 with COMMENTS / COMMITS (tab-separated "time<TAB>first line") and GATE_NOW skips gh
#   for the evaluator (tests/unit/gate.test.mjs); posting commands still need gh.
R=odinguard009/aeterna-experiment; L=1
# Issue #1 of a public repo takes comments from anyone: only the owner's account and the "Auto mode" workflow (github-actions[bot]) can
# switch auto / chain mode or write session markers (audit 2026-10-27). Every read of the issue comments goes through this filter.
TRUSTED_JQ='.[] | select(.user.login == "odinguard009" or .user.login == "github-actions[bot]")'
LANES="ui card"
lane_ok() { [ -z "${1:-}" ] || case " $LANES " in *" $1 "*) return 0 ;; *) echo "unknown lane '$1' (use: $LANES)" >&2; return 1 ;; esac; }
IDLE_MIN=0       # min idle minutes since the last session/owner activity; 0 = no wait (owner, 2026-10-20, was 20)
STALE_H=5        # a LOCK older than this is a crashed auto session
MANUAL_H=3       # a MANUAL older than this is a crashed manual session
NOPROG=0         # auto sessions without a new v* commit before the switch goes OFF by itself; 0 = never (owner, 2026-10-20, was 3)
RANTAI_MAX=${GATE_RANTAI_MAX:-999999999999}  # chain budget and single-session ceiling in tokens (owner, 2026-10-28: unlimited; was 1,000,000 on 2026-10-27)
MAX_AUTO_24H=${GATE_MAX_AUTO_24H:-0}   # max auto sessions (LOCK) in 24 hours; 0 = unlimited (owner, 2026-10-20); GATE_MAX_AUTO_24H only lets the test exercise the cap
post() { if [ "${GATE_PRINT:-}" = 1 ]; then echo "POST $1"; return 0; fi; gh api -X POST "repos/$R/issues/$L/comments" -f body="$1" --jq .created_at >/dev/null; }   # GATE_PRINT=1: tests see the body
# Item T (owner, 2026-10-21): the session writes the budget counter it sees at the start ("lock|manual [lane] budget=N") and at the end
# ("done ... budget=N"; or "done ... start=<Token awal> budget=<now>" when the marker has none, e.g. the scheduled prompt's plain "lock");
# the gate subtracts and posts tokens=, so no mental arithmetic (v0.89.0 reported 38,460 for a ~1,400-line session).
start_budget() { # budget=N of the newest LOCK / MANUAL marker; empty when that marker has none
  local c
  if [ "${GATE_FIXTURE:-}" = 1 ]; then c="${COMMENTS:-}"
  else c=$(pages "repos/$R/issues/$L/comments?per_page=100&since=$(date -u -d '-2 days' +%Y-%m-%dT%H:%M:%SZ)" "$TRUSTED_JQ"' | [.created_at, (.body | split("\n")[0])] | @tsv') || return 1; fi
  printf '%s\n' "$c" | sort | awk -F'\t' '$2 ~ /^(LOCK|MANUAL)( |$)/ { b = ""; if (match($2, /budget=[0-9]+/)) b = substr($2, RSTART + 7, RLENGTH - 7); last = b } END { print last }'
}
split_budget() { # $1 = args; prints "<args without budget=/start=>|<budget N>|<start N>"; a lane word stays
  local a="" b="" st="" w; for w in $1; do case "$w" in budget=*) b="${w#budget=}" ;; start=*) st="${w#start=}" ;; *) a="${a:+$a }$w" ;; esac; done; printf '%s|%s|%s\n' "$a" "$b" "$st"
}
pages() { # gh --paginate follows Link headers to repositories/<id>/..., which the session proxy refuses: walk ?page=N on repos/ paths instead
  local url="$1" jq="$2" n=1 out cnt
  while :; do
    out=$(gh api "$url&page=$n" --jq "$jq") || return 1
    [ -n "$out" ] && printf '%s\n' "$out"
    cnt=$(gh api "$url&page=$n" --jq 'length') || return 1
    [ "$cnt" -lt 100 ] && break; n=$((n+1)); [ $n -gt 50 ] && break
  done
}
evaluate() { # prints one line: <verdict> <reason...>; verdicts GO, STOP, AUTOOFF, plus state for status/busy
  local since comments commits stop_file
  if [ "${GATE_FIXTURE:-}" = 1 ]; then
    comments="${COMMENTS:-}"; commits="${COMMITS:-}"; stop_file="${STOP_FILE:-0}"
  else
    since=$(date -u -d '-7 days' +%Y-%m-%dT%H:%M:%SZ)
    comments=$(pages "repos/$R/issues/$L/comments?per_page=100&since=$since" "$TRUSTED_JQ"' | [.created_at, (.body | split("\n")[0])] | @tsv') || return 1
    commits=$(gh api "repos/$R/commits?per_page=100&since=$since" --jq '.[] | [.commit.committer.date, (.commit.message | split("\n")[0])] | @tsv') || return 1
    stop_file=0; gh api "repos/$R/contents/docs/ai/chain-stop.md" >/dev/null 2>&1 && stop_file=1
  fi
  MODE="$1" WANT="${2:-}" LANE="${3:-}" LANES="$LANES" STOP_FILE=$stop_file IDLE_MIN=$IDLE_MIN STALE_H=$STALE_H MANUAL_H=$MANUAL_H NOPROG=$NOPROG MAXA=$MAX_AUTO_24H \
  COMMENTS="$comments" COMMITS="$commits" python3 - <<'PY'
import os, re, datetime as dt
E = os.environ
def t(s): return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
def rows(name):
    out = []
    for line in E[name].splitlines():
        if "\t" in line:
            a, b = line.split("\t", 1); out.append((t(a), b.strip()))
    return sorted(out)
now = t(E["GATE_NOW"]) if E.get("GATE_NOW") else dt.datetime.now(dt.timezone.utc)
cm, co = rows("COMMENTS"), rows("COMMITS")
word = lambda b: (b.split() or [""])[0].upper()
SW, SES = {"ON", "OFF"}, {"LOCK", "MANUAL", "DONE", "UNLOCK"}
LANES = E["LANES"].split()
sw = [c for c in cm if word(c[1]) in SW]
switch = word(sw[-1][1]) if sw else "OFF"
def lane_of(b):
    p = b.split()
    return p[1].lower() if len(p) > 1 and p[1].lower() in LANES else ""
# running sessions per scope ("" = no lane = whole repo): starts add, ends remove (DONE and a lane-less UNLOCK end all)
run = {}
for ts, b in cm:
    w, ln = word(b), lane_of(b)
    if w in {"LOCK", "MANUAL"}: run[ln] = (w, ts)
    elif w == "DONE" or (w == "UNLOCK" and not ln): run = {}
    elif w == "UNLOCK" and ln: run.pop(ln, None)
def alive(k):
    w, ts = run[k]; age_h = (now - ts).total_seconds() / 3600
    return age_h < float(E["STALE_H"] if w == "LOCK" else E["MANUAL_H"])
lane = E.get("LANE", "").lower()
scopes = [k for k in run if alive(k) and (not lane or k in ("", lane))]
def desc(k):
    w, ts = run[k]
    return f"{'auto' if w == 'LOCK' else 'manual'} session{(' (' + k + ' lane)') if k else ''} running ({int((now - ts).total_seconds() // 60)} min)"
active = "; ".join(desc(k) for k in sorted(scopes, key=lambda k: (run[k][0] != "LOCK", k)))  # auto first: "BUSY auto" = an auto session holds a lock
acts = [c[0] for c in cm if word(c[1]) not in SW] + [c[0] for c in co]
idle = int((now - max(acts)).total_seconds() // 60) if acts else 10**6
rel = [c[0] for c in co if re.match(r"v[0-9]", c[1])]
base = max(rel[-1:] + [c[0] for c in cm if word(c[1]) in {"ON", "RESET"}][-1:] or [now - dt.timedelta(days=7)])
noprog = sum(1 for c in cm if word(c[1]) == "LOCK" and c[0] > base)
last_on = max([c[0] for c in cm if word(c[1]) == "ON"][-1:] or [now - dt.timedelta(days=7)])
auto24 = sum(1 for c in cm if word(c[1]) == "LOCK" and now - c[0] < dt.timedelta(hours=24) and c[0] > last_on)
mode = E["MODE"]
done = [c for c in cm if word(c[1]) == "DONE"]
m = re.search(r"next=(\w+)", done[-1][1], re.I) if done else None
next_model = "opus"  # owner 2026-10-17: Opus for every session; next= tags are kept for history only
want = E.get("WANT", "").lower()
if mode == "status":
    print(f"Mode otomatis: {switch} | sesi: {active or 'tidak ada'} | idle {idle} min | sesi otomatis 24 jam: {auto24}/{E['MAXA'] if int(E['MAXA']) else 'tanpa batas'} | tanpa rilis: {noprog}/{E['NOPROG'] if int(E['NOPROG']) else 'tanpa batas'} | model berikutnya: {next_model}" + (" | chain-stop.md ADA" if E["STOP_FILE"] == "1" else ""))
elif mode == "switch": print(switch)
elif mode == "busy": print(("BUSY " + active) if active else "FREE")
elif E["STOP_FILE"] == "1": print("STOP chain-stop.md exists")
elif switch == "OFF": print("STOP auto mode is OFF")
elif active: print("STOP " + active)
elif int(E["NOPROG"]) > 0 and noprog >= int(E["NOPROG"]): print(f"AUTOOFF no progress: {noprog} auto sessions without a new v* release")
elif idle < int(E["IDLE_MIN"]): print(f"STOP idle {idle} min < {E['IDLE_MIN']}")
elif int(E["MAXA"]) > 0 and auto24 >= int(E["MAXA"]): print(f"STOP daily cap: {auto24} auto sessions in 24 h")
elif want and want != next_model: print(f"STOP next item needs {next_model}, this task runs {want}")
else: print("GO")
PY
}
hemat_state() { # newest "HEMAT ON|OFF" comment on issue #1 (whole history: the switch can be older than 7 days); none = ON
  local rows
  if [ "${GATE_FIXTURE:-}" = 1 ]; then rows=$(printf '%s\n' "${COMMENTS:-}" | cut -f2-)
  else rows=$(pages "repos/$R/issues/$L/comments?per_page=100" "$TRUSTED_JQ"' | .body | split("\n")[0]') || return 1; fi
  printf '%s\n' "$rows" | grep -iE '^HEMAT[[:space:]]+(ON|OFF)\b' | tail -1 | awk '{v=toupper($2)} END {print (v=="OFF" ? "OFF" : "ON")}'
}
rantai_eval() { # chain mode; $1 = status|next; prints one line (next: GO|STOP|AUTOOFF ...)
  local rows
  if [ "${GATE_FIXTURE:-}" = 1 ]; then rows="${COMMENTS:-}"
  else rows=$(pages "repos/$R/issues/$L/comments?per_page=100" "$TRUSTED_JQ"' | [.created_at, (.body | split("\n")[0])] | @tsv') || return 1; fi
  MODE="$1" MAXT=$RANTAI_MAX ROWS="$rows" python3 - <<'PY'
import os, re
E = os.environ; MAXT = int(E["MAXT"])
rows = sorted(tuple(l.split("\t", 1)) for l in E["ROWS"].splitlines() if "\t" in l)
sw, chain, stop = "OFF", [], False
for ts, b in rows:  # chain = the newest DONE plus the DONEs it continues ("rantai" tag), back to its head
    p = b.split(); w = p[0].upper() if p else ""
    if w == "RANTAI" and len(p) > 1 and p[1].upper() in ("ON", "OFF"): sw = p[1].upper(); chain = []
    elif w == "DONE":
        m = re.search(r"tokens=(\d+)", b); n = int(m.group(1)) if m else None
        cont = any(x.lower() == "rantai" for x in p[2:])
        ver = p[1] if len(p) > 1 else "?"
        chain = (chain if cont else []) + [(ver, n)]
total = sum(n or 0 for _, n in chain); k = len(chain)
line = f"Mode rantai: {sw} | rantai terakhir: {total:,} / {MAXT:,} token ({k} sesi)".replace(",", ".")
if E["MODE"] == "status": print(line)
else:
    last = chain[-1] if chain else None
    if sw == "OFF": print("STOP " + line)
    elif not last or last[1] is None: print("STOP no tokens= on the last DONE | " + line)
    elif last[1] > MAXT: print(f"AUTOOFF session {last[0]} used {last[1]} tokens (> {MAXT})")
    elif total >= MAXT: print("STOP chain budget reached | " + line)
    else: print("GO " + line)
PY
}
cmd=${1:-check}; shift || true
case "$cmd" in
  check)
    lane_ok "${2:-}" || exit 2
    v=$(evaluate check "${1:-}" "${2:-}") || { echo "STOP gate error (gh api failed)"; exit 1; }
    case "$v" in
      AUTOOFF*) post "OFF auto: ${v#AUTOOFF }. Owner: fix the cause, then 'otomatis on'." ; echo "STOP ${v#AUTOOFF } (switch set to OFF)" ;;
      *) echo "$v" ;;
    esac ;;
  lock)   IFS='|' read -r a b sb <<< "$(split_budget "$*")"; set -- $a
          lane_ok "${1:-}" || exit 2; v=$(evaluate busy "" "${1:-}") || exit 1; [ "${v%% *}" = BUSY ] && { echo "STOP ${v#BUSY }"; exit 3; }; post "LOCK${1:+ $1}${b:+ budget=$b}" && echo "locked${1:+ ($1 lane)}" ;;
  manual) IFS='|' read -r a b sb <<< "$(split_budget "$*")"; set -- $a
          lane_ok "${1:-}" || exit 2; v=$(evaluate busy "" "${1:-}") || exit 1; case "$v" in BUSY\ auto*) echo "STOP ${v#BUSY }"; exit 3 ;; esac; post "MANUAL${1:+ $1}${b:+ budget=$b}" && echo "manual session marked${1:+ ($1 lane)}" ;;
  done)   IFS='|' read -r a b sb <<< "$(split_budget "$*")"
          # owner 2026-10-21: "sub=N" = tokens the session's subagents used (their hand-back usage); added to the computed tokens= and kept on the line
          su=0; a2=""; for w in $a; do case "$w" in sub=*) su="${w#sub=}"; [[ "$su" =~ ^[0-9]+$ ]] || su=0 ;; *) a2="${a2:+$a2 }$w" ;; esac; done; a=$a2
          if [ -n "$b" ] && [[ " $a " != *" tokens="* ]]; then
            st=$sb; [ -n "$st" ] || st=$(start_budget) || st=""   # start=<Token awal> on the done line, else budget= of the LOCK/MANUAL
            if [ -n "$st" ] && [ "$st" -ge "$b" ]; then a="$a tokens=$((st - b + su))${su:+$([ "$su" -gt 0 ] && echo " sub=$su")}"
            else echo "WARN no usable budget= on the session's LOCK/MANUAL (start '${st}', end $b): DONE posted without tokens= (chain mode stops)" >&2; fi
          fi
          post "DONE $a" && echo "done $a" ;;
  unlock) lane_ok "${1:-}" || exit 2; post "UNLOCK${1:+ $1}" && echo "unlocked${1:+ ($1 lane)}" ;;
  on)     post "ON ${*:-}" && echo "Mode otomatis: ON" ;;
  off)    post "OFF ${*:-}" && echo "Mode otomatis: OFF" ;;
  hemat)  case "${1:-status}" in
            on|ON)   post "HEMAT ON ${*:2}" && echo "Mode hemat: ON" ;;
            off|OFF) post "HEMAT OFF ${*:2}" && echo "Mode hemat: OFF" ;;
            status)  v=$(hemat_state) || { echo "gate error (gh api failed)"; exit 1; }; echo "Mode hemat: $v" ;;
            *) echo "usage: $0 hemat on|off|status"; exit 2 ;;
          esac ;;
  rantai) case "${1:-status}" in
            on|ON)   post "RANTAI ON ${*:2}" && echo "Mode rantai: ON" ;;
            off|OFF) post "RANTAI OFF ${*:2}" && echo "Mode rantai: OFF" ;;
            status|next) v=$(rantai_eval "${1:-status}") || { echo "STOP gate error (gh api failed)"; exit 1; }
                     case "$v" in
                       AUTOOFF*) post "RANTAI OFF auto: ${v#AUTOOFF }" ; echo "STOP ${v#AUTOOFF } (Mode rantai: OFF)" ;;
                       *) echo "$v" ;;
                     esac ;;
            *) echo "usage: $0 rantai on|off|status|next"; exit 2 ;;
          esac ;;
  switch|status) evaluate "$cmd" || { echo "gate error (gh api failed)"; exit 1; } ;;
  busy)   lane_ok "${1:-}" || exit 2; v=$(evaluate busy "" "${1:-}") || exit 1; echo "$v"; [ "${v%% *}" = BUSY ] && exit 3; exit 0 ;;
  *) echo "usage: $0 check opus [lane]|lock [lane]|manual [lane]|done vX.Y.Z next=Opus|unlock [lane]|on|off [why]|hemat on|off|status|rantai on|off|status|next|switch|status|busy [lane]  (lanes: $LANES)"; exit 2 ;;
esac

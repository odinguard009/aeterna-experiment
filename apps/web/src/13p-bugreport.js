/* ---------------------------------------------------------------------
   REPORT A BUG (v0.134.0, U14i): a form on every page that opens a pre-filled "new issue" page of the repository. The player sends it
   with their own GitHub login; no token or server is involved and nothing is sent from here. Display only: nothing touches the rules.
   --------------------------------------------------------------------- */
const BUG_REPO = 'https://github.com/odinguard009/aeterna-experiment/issues/new';
const BUG_LABEL = { bug: 'bug', display: 'bug', card: 'card data', idea: 'idea' };
function bugURL(kind, title, text, withInfo, view, steps, log) {
  const info = withInfo ? `

---
Version: v${VERSION}
Page: ${view || '?'}
Screen: ${innerWidth}x${innerHeight}` : '';
  const q = new URLSearchParams({ title: String(title).trim().slice(0, 100), body: (String(text).trim().slice(0, 1500) + (steps && String(steps).trim() ? '\n\nSteps to reproduce:\n' + String(steps).trim().slice(0, 800) : '') + (log ? '\n\nRecent match log:\n' + String(log).slice(0, 700) : '') + info).slice(0, 4000), labels: BUG_LABEL[kind] || 'bug' });
  return BUG_REPO + '?' + q.toString();
}
function bugOpen(on) {
  const o = $('bug-overlay'); if (!o) return;
  o.hidden = !on;
  if (on) $('bug-title').focus();
}
function bugSend() {   // the three fields below are inputs of the form
  const view = (document.querySelector('.app-view.active') || {}).id || '';
  const log = $('bug-log').checked && typeof G !== 'undefined' && G && G.history ? G.history.slice(-8).map(h => '- ' + String(h && h.text || h).replace(/<[^>]*>/g, '')).join('\n') : '';
  const url = bugURL($('bug-kind').value, $('bug-title').value, $('bug-text').value, $('bug-info').checked, view, $('bug-steps').value, log);
  window.open(url, '_blank', 'noopener'); bugOpen(false); /** @type {any} */ ($("bug-form")).reset();
}

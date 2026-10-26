/* ---------------------------------------------------------------------
   REPORT A BUG (v0.134.0, U14i): a form on every page that opens a pre-filled "new issue" page of the repository. The player sends it
   with their own GitHub login; no token or server is involved and nothing is sent from here. Display only: nothing touches the rules.
   --------------------------------------------------------------------- */
const BUG_REPO = 'https://github.com/odinguard009/aeterna-experiment/issues/new';
const BUG_LABEL = { bug: 'bug', card: 'card data', idea: 'idea' };
function bugURL(kind, title, text, withInfo, view) {
  const info = withInfo ? `

---
Version: v${VERSION}
Page: ${view || '?'}
Screen: ${innerWidth}x${innerHeight}` : '';
  const q = new URLSearchParams({ title: String(title).trim().slice(0, 100), body: (String(text).trim().slice(0, 2000) + info).slice(0, 4000), labels: BUG_LABEL[kind] || 'bug' });
  return BUG_REPO + '?' + q.toString();
}
function bugOpen(on) {
  const o = $('bug-overlay'); if (!o) return;
  o.hidden = !on;
  if (on) $('bug-title').focus();
}
function bugSend() {   // the three fields below are inputs of the form
  const view = (document.querySelector('.app-view.active') || {}).id || '';
  const url = bugURL($('bug-kind').value, $('bug-title').value, $('bug-text').value, $('bug-info').checked, view);
  window.open(url, '_blank', 'noopener'); bugOpen(false); /** @type {any} */ ($("bug-form")).reset();
}

# Test helper: after every Page.goto of a game file, define the test-only fixture cards (see fixtures/prototype_cards.js).
# Use:  PYTHONPATH=<this dir> python3 some_test.py
import os
import sys
try:
    from playwright.sync_api import Page
    _JS = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'prototype_cards.js'), encoding='utf-8').read()
    _orig = Page.goto
    def _file_url(url):
        # Windows checkout (2026-10-31): the suites and tools/run_all.py use the Linux paths /mnt/... and /tmp/...; Python maps
        # them to C:\mnt and C:\tmp, but a file:/// URL has no drive and Chromium cannot open it. Add the drive when the file exists.
        if sys.platform != 'win32' or not isinstance(url, str) or not url.startswith('file:///'):
            return url
        from urllib.parse import urlparse, unquote
        path = unquote(urlparse(url).path)
        if path.startswith('/mnt/') or path.startswith('/tmp/'):
            local = os.path.abspath(path)
            if os.path.exists(local):
                return 'file:///' + local.replace(os.sep, '/')
        return url
    def goto(self, url, *a, **k):
        r = _orig(self, _file_url(url), *a, **k)
        try: self.evaluate(_JS)
        except Exception: pass
        return r
    Page.goto = goto
except Exception:
    pass

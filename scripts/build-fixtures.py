#!/usr/bin/env python3
"""Builds the derived test documents from fetched Harvey LAB documents (harveyai/harvey-labs, MIT).

    build-fixtures.py FIXTURES_DIR LONG_FIXTURES_DIR

Python 3 standard library only: the WordprocessingML is edited as text (zipfile + regular
expressions), never through a document library or a word processor. Output is byte-deterministic:
the zip keeps the source's entry order, every entry is stored (no compression, so the bytes do not
depend on the zlib build) with a fixed timestamp. scripts/fetch-fixtures.sh runs this script and
then checks each output against the sha256 recorded in fixtures.tsv / long-fixtures.tsv.

Inputs (FIXTURES_DIR): tidemark-draft-confirmation.docx, greenleaf-marked-confirmation.docx,
stonehill-first-markup-csa.docx. Outputs:
  FIXTURES_DIR/greenleaf-revised-confirmation.docx            greenleaf markup made clean
  FIXTURES_DIR/swap-confirmation-counterparty.docx            tidemark draft + 26 tracked changes
  FIXTURES_DIR/swap-confirmation-counterparty.expected.docx   grading reference (A set applied)
  LONG_FIXTURES_DIR/long-csa-counter-redline/stonehill-first-markup-csa.docx
                                                               property order fixed, banner removed
"""
import html
import os
import re
import sys
import zipfile

FIXED_TIME = (1980, 1, 1, 0, 0, 0)


# --- zip -------------------------------------------------------------------------------------

def read_docx(path):
    with zipfile.ZipFile(path) as z:
        return [(i.filename, z.read(i.filename)) for i in z.infolist()]


def write_docx(path, entries):
    tmp = path + '.part'
    with zipfile.ZipFile(tmp, 'w') as z:
        for name, data in entries:
            zi = zipfile.ZipInfo(name, FIXED_TIME)
            zi.compress_type = zipfile.ZIP_STORED
            zi.create_system = 3
            zi.external_attr = 0o644 << 16
            z.writestr(zi, data)
    os.replace(tmp, path)
    print('built ' + os.path.basename(path))


def replace_part(entries, name, text):
    return [(n, text.encode('utf-8') if n == name else d) for n, d in entries]


def part(entries, name):
    return dict(entries)[name].decode('utf-8')


# --- canonical property order (ECMA-376 Part 1 schema sequences) -------------------------------

RPR_ORDER = ('ins del moveFrom moveTo rStyle rFonts b bCs i iCs caps smallCaps strike dstrike '
             'outline shadow emboss imprint noProof snapToGrid vanish webHidden color spacing w kern '
             'position sz szCs highlight u effect bdr shd fitText vertAlign rtl cs em lang '
             'eastAsianLayout specVanish oMath rPrChange').split()
PPR_ORDER = ('pStyle keepNext keepLines pageBreakBefore framePr widowControl numPr '
             'suppressLineNumbers pBdr shd tabs suppressAutoHyphens kinsoku wordWrap overflowPunct '
             'topLinePunct autoSpaceDE autoSpaceDN bidi adjustRightInd snapToGrid spacing ind '
             'contextualSpacing mirrorIndents suppressOverlap jc textDirection textAlignment '
             'textboxTightWrap outlineLvl divId cnfStyle rPr sectPr pPrChange').split()
TBLPR_ORDER = ('tblStyle tblpPr tblOverlap bidiVisual tblStyleRowBandSize tblStyleColBandSize tblW '
               'jc tblCellSpacing tblInd tblBorders shd tblLayout tblCellMar tblLook tblCaption '
               'tblDescription tblPrChange').split()
ORDERS = {'w:rPr': RPR_ORDER, 'w:pPr': PPR_ORDER, 'w:tblPr': TBLPR_ORDER}
TAG = re.compile(r'(<[^>]+>)')


def canonical_order(xml):
    """Reorders the children of every w:rPr, w:pPr and w:tblPr to schema order (stable)."""
    root = [None, '', [], '']           # [name, open tag, children, close tag]
    stack = [root]
    for tok in TAG.split(xml):
        if not tok:
            continue
        if tok[0] == '<' and tok[1] not in '?!':
            if tok[1] == '/':
                stack.pop()[3] = tok
                continue
            name = re.match(r'<([^\s/>]+)', tok).group(1)
            el = [name, tok, None if tok.endswith('/>') else [], '']
            stack[-1][2].append(el)
            if el[2] is not None:
                stack.append(el)
        else:
            stack[-1][2].append(tok)
    assert len(stack) == 1, 'unbalanced XML'

    def walk(el):
        kids = el[2]
        if kids is None:
            return
        for k in kids:
            if isinstance(k, list):
                walk(k)
        order = ORDERS.get(el[0])
        if order and all(isinstance(k, list) for k in kids):
            def key(k):
                local = k[0].split(':', 1)[1]
                if local not in order:
                    raise SystemExit('unknown child %s in %s' % (k[0], el[0]))
                return order.index(local)
            kids.sort(key=key)

    def ser(el):
        if el[2] is None:
            return el[1]
        return el[1] + ''.join(k if isinstance(k, str) else ser(k) for k in el[2]) + el[3]

    walk(root)
    return ser(root)


# --- paragraphs and runs --------------------------------------------------------------------

PARA = re.compile(r'<w:p(?: [^>]*)?/>|<w:p(?: [^>]*)?>.*?</w:p>', re.S)
RUN = re.compile(r'<w:r(?: [^>]*)?>.*?</w:r>', re.S)
SIMPLE_RUN = re.compile(r'<w:r>(<w:rPr>.*?</w:rPr>)?<w:t(?: [^>]*)?>([^<]*)</w:t></w:r>$', re.S)
T = re.compile(r'<w:t(?: [^>]*)?>([^<]*)</w:t>')


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def ptext(p):
    return ''.join(html.unescape(t) for t in T.findall(p))


class Para:
    """A paragraph as head (<w:p> + pPr), items and tail. Items are simple text runs
    ['r', rPr, text, original xml or None] or raw XML ['x', xml]."""

    def __init__(self, xml):
        m = re.match(r'(<w:p(?: [^>]*)?>(?:<w:pPr>.*?</w:pPr>)?)(.*)(</w:p>)$', xml, re.S)
        self.head, body, self.tail = m.groups()
        self.items = []
        pos = 0
        for r in RUN.finditer(body):
            if r.start() > pos:
                self.items.append(['x', body[pos:r.start()]])
            s = SIMPLE_RUN.match(r.group(0))
            if s:
                self.items.append(['r', s.group(1) or '', html.unescape(s.group(2)), r.group(0)])
            else:
                self.items.append(['x', r.group(0)])
            pos = r.end()
        if pos < len(body):
            self.items.append(['x', body[pos:]])

    def text(self):
        return ''.join(i[2] for i in self.items if i[0] == 'r')

    def xml(self):
        out = [self.head]
        for i in self.items:
            if i[0] == 'x':
                out.append(i[1])
            elif i[3] is not None:
                out.append(i[3])
            elif i[2]:
                out.append('<w:r>%s<w:t xml:space="preserve">%s</w:t></w:r>' % (i[1], esc(i[2])))
        return ''.join(out) + self.tail

    def split_at(self, off):
        """Splits the run containing offset off; returns the item index starting at off."""
        pos = 0
        for n, i in enumerate(self.items):
            if i[0] != 'r':
                continue
            if pos == off:
                return n
            if pos < off < pos + len(i[2]):
                a, b = i[2][:off - pos], i[2][off - pos:]
                self.items[n:n + 1] = [['r', i[1], a, None], ['r', i[1], b, None]]
                return n + 1
            pos += len(i[2])
        assert pos == off, (pos, off)
        return len(self.items)

    def edit(self, start, end, new, track=None):
        """Replaces text [start, end) by new. track = (id iterator, author, date) writes a
        tracked deletion directly followed by a tracked insertion; None edits in place."""
        a = self.split_at(start)
        b = self.split_at(end) if end > start else a
        removed = [i for i in self.items[a:b] if i[0] == 'r']
        assert all(i[0] == 'r' for i in self.items[a:b]), 'edit spans non-text content'
        if removed:
            rpr = removed[0][1]
        else:
            before = [i for i in self.items[:a] if i[0] == 'r']
            after = [i for i in self.items[a:] if i[0] == 'r']
            rpr = (before[-1] if before else after[0])[1]
        out = []
        if track:
            ids, author, date = track
            if removed:
                runs = ''.join('<w:r>%s<w:delText xml:space="preserve">%s</w:delText></w:r>'
                               % (i[1], esc(i[2])) for i in removed)
                out.append(['x', '<w:del w:id="%d" w:author="%s" w:date="%s">%s</w:del>'
                            % (next(ids), author, date, runs)])
            if new:
                out.append(['x', '<w:ins w:id="%d" w:author="%s" w:date="%s"><w:r>%s<w:t '
                            'xml:space="preserve">%s</w:t></w:r></w:ins>'
                            % (next(ids), author, date, rpr, esc(new))])
        elif new:
            out.append(['r', rpr, new, None])
        self.items[a:b] = out

    def delete(self, start, end):
        self.edit(start, end, '')


def paragraphs(doc):
    """(prefix, [paragraph xml], suffix) of the body: the paragraphs and the text between them."""
    parts, pos = [], 0
    for m in PARA.finditer(doc):
        parts.append(doc[pos:m.start()])
        parts.append(m.group(0))
        pos = m.end()
    parts.append(doc[pos:])
    return parts            # even indices: between, odd indices: paragraphs


# --- A: greenleaf-revised-confirmation --------------------------------------------------------

def accept_all(doc):
    """Accepts every tracked insertion and deletion (run level; this source has no paragraph-mark
    or formatting revisions, which is asserted)."""
    assert not re.search(r'<w:(rPrChange|pPrChange|moveFrom|moveTo)\b', doc)
    assert not re.search(r'<w:rPr>(?:(?!</w:rPr>).)*<w:(ins|del) ', doc, re.S)
    doc = re.sub(r'<w:del [^>]*>.*?</w:del>', '', doc, flags=re.S)
    doc = re.sub(r'<w:ins [^>]*>(.*?)</w:ins>', r'\1', doc, flags=re.S)
    return doc


def build_revised(src, out):
    entries = read_docx(src)
    doc = part(entries, 'word/document.xml')
    assert 'w:commentReference' not in doc
    parts = paragraphs(doc)
    revised = {i for i in range(1, len(parts), 2) if re.search(r'<w:(ins|del) ', parts[i])}
    before = {i: ''.join(re.findall(r'<w:(?:t|delText)(?: [^>]*)?>([^<]*)<', parts[i]))
              for i in range(1, len(parts), 2)}
    parts = paragraphs(accept_all(doc))
    paras = {i: Para(parts[i]) if parts[i] != '<w:p/>' else None for i in range(1, len(parts), 2)}

    def find_pr(text_test):
        for i in range(1, len(parts), 2):
            p = paras[i]
            if p and text_test(p.text()):
                return p.head, next(it[1] for it in p.items if it[0] == 'r')
        raise SystemExit('reference paragraph not found')

    heading_head, heading_rpr = find_pr(lambda t: t == '3.1 ISDA 2020 IBOR Fallbacks Protocol Incorporation')
    item_head, _ = find_pr(lambda t: t.startswith('(a) In the case of an Early Termination Date'))
    log = []

    # A space run left between an accepted deletion and insertion would double a space.
    for i in sorted(revised):
        p, pos = paras[i], 0
        for it in p.items:
            if it[0] != 'r':
                continue
            if it[2] == ' ' and (pos == 0 or p.text()[pos - 1] == ' '):
                it[2], it[3] = '', None
            pos += len(it[2])

    in_deleted, in_indent, drop = False, False, set()
    for i in range(1, len(parts), 2):
        p = paras[i]
        if p is None:
            continue
        t0 = p.text()
        if t0.startswith('### '):
            p.delete(0, 4)
            p.head = heading_head
            for it in p.items:
                if it[0] == 'r':
                    it[1], it[3] = heading_rpr, None
            log.append('heading: "### " removed, formatting of 3.1 heading: ' + p.text())
        if in_deleted:
            end = p.text().find(']')
            if end < 0:
                drop.add(i)
                continue
            assert end == len(p.text()) - 1, p.text()
            drop.add(i)
            in_deleted = False
            log.append('[DELETED] span ends, paragraph removed: ' + p.text()[:60])
            continue
        while True:
            t = p.text()
            m = re.search(r'\[(DELETED|ADDED): ', t)
            if not m:
                break
            end = t.find(']', m.end())
            if m.group(1) == 'DELETED':
                if end < 0:                       # runs over the following paragraphs
                    assert m.start() == 0, t
                    drop.add(i)
                    in_deleted = True
                    log.append('[DELETED] span starts, paragraph removed: ' + t[:60])
                    break
                a, b = m.start(), end + 1
                if b < len(t) and t[b] == ' ':
                    b += 1
                elif a > 0 and t[a - 1] == ' ':
                    a -= 1
                p.delete(a, b)
                log.append('[DELETED: %s] removed in: %s' % (t[m.end():end], p.text()))
            else:
                if end >= 0:
                    p.delete(end, end + 1)
                    p.delete(m.start(), m.end())
                    log.append('[ADDED: ...] brackets removed in: ' + p.text())
                else:                             # closing bracket in a later paragraph
                    p.delete(m.start(), m.end())
                    log.append('[ADDED: opened (content kept): ' + p.text()[:60])
                    break
        if i in drop:
            continue
        t = p.text()
        if t.startswith('<!-- indent:1 --> '):
            p.delete(0, len('<!-- indent:1 --> '))
            in_indent = True
        if in_indent:
            p.head = item_head
            log.append('lettered item, indent comment dropped, formatting of the draft\'s lettered items: ' + p.text()[:60])
            t = p.text()
            for closer in (' <!-- /indent -->]', ' <!-- /indent -->'):
                if t.endswith(closer):
                    p.delete(len(t) - len(closer), len(t))
                    in_indent = False
                    break
        t = p.text()
        assert '<!--' not in t and '[DELETED' not in t and '[ADDED' not in t, t
        if t.endswith(']') and t.count(']') > t.count('['):
            p.delete(len(t) - 1, len(t))
            log.append('closing ] of [ADDED: ...] removed: ' + p.text()[:60])
    assert not in_deleted and not in_indent
    for i in range(1, len(parts), 2):
        p = paras[i]
        if p is None or i in drop:
            continue
        if before[i].strip() and not p.text().strip():
            drop.add(i)
            log.append('blank paragraph left by an accepted deletion removed (was: %s)' % before[i][:60])
    for i in range(1, len(parts), 2):
        if i in drop:
            parts[i] = ''
        elif paras[i] is not None:
            parts[i] = paras[i].xml()
    doc = canonical_order(''.join(parts))
    assert not re.search(r'<w:(ins|del) ', doc)
    write_docx(out, replace_part(entries, 'word/document.xml', doc))
    return log


# --- B: swap-confirmation-counterparty (+ .expected) ------------------------------------------

AUTHOR = 'Counterparty Counsel'
DATE = '2025-07-18T09:00:00Z'

# (set, paragraph test, text before the change, deleted, inserted, occurrence of the paragraph)
# A paragraph test is ('eq', text) or ('in', text). The change is at the first occurrence of
# before + deleted in the paragraph.
CHANGES = [
    ('A1', ('in', 'this Confirmation will prevail'), 'this Confirmation ', 'will', 'shall', 0),
    ('R1', ('eq', 'July 22, 2025'), '', 'July 22, 2025', 'July 29, 2025', 0),
    ('R2', ('in', 'USD 250,000,000 (two hundred fifty million'), 'USD ',
     '250,000,000 (two hundred fifty million', '200,000,000 (two hundred million', 0),
    ('A2', ('in', 'Federal Reserve Bank of New York is open for business'), 'is open for business', '',
     ', and commercial banks are open for general business in New York City', 0),
    ('R6', ('in', 'commencing January 22, 2026'), 'commencing ', 'January 22, 2026', 'July 22, 2026', 0),
    ('A3', ('in', 'shall be Tidemark National Bank ("Party B"), acting in its sole capacity'),
     'Schedule to the Agreement', '',
     '; provided that, if an Event of Default has occurred and is continuing with respect to Party B, '
     'Party A may appoint a leading dealer as substitute Calculation Agent', 0),
    ('A4', ('in', 'Party A acknowledges and agrees that the Calculation Agent'), 'absent manifest error', '',
     ' or bad faith', 0),
    ('A5', ('in', 'Party A acknowledges and agrees that the Calculation Agent'), 'Transaction.',
     " Party A acknowledges and agrees that the Calculation Agent's determinations, absent manifest error, "
     'shall not be subject to challenge, review, or modification by any third party, arbitrator, or tribunal.',
     '', 0),
    ('A6', ('in', 'in its sole and absolute discretion, to determine and select'), '',
     'in its sole and absolute discretion', 'acting in good faith and in a commercially reasonable manner', 0),
    ('A7', ('in', 'have no obligation to consult with Party A'), 'shall ',
     'have no obligation to consult with Party A or any other person, entity, or market participant',
     'consult in good faith with Party A', 0),
    ('A8', ('in', 'shall have the right, but not the obligation, to designate'), '',
     'shall have the right, but not the obligation, to', 'may', 0),
    ('A9', ('in', 'on negative watch, negative outlook, or review'), 'negative watch, ', 'negative outlook, ', '', 0),
    ('A10', ('in', 'the Determining Party may, in its sole discretion:'), 'may, in ', 'its sole discretion',
     'good faith', 0),
    ('A11', ('in', 'and third-party data providers'), 'and ', '', 'reputable ', 0),
    ('A12', ('in', 'The Determining Party may, but is not required to, seek'), 'The Determining Party ',
     'may, but is not required to,', 'shall', 0),
    ('A13', ('in', 'the CSA shall govern'), 'Confirmation, ', 'the CSA', 'this Confirmation', 0),
    ('R3', ('eq', 'USD 10,000,000'), 'USD ', '10,000,000', '20,000,000', 0),
    ('R4', ('eq', 'USD 500,000'), 'USD ', '500,000', '250,000', 0),
    ('A14', ('eq', 'Cash (USD) and U.S. Treasury Securities (subject to a 2% haircut)'),
     'U.S. Treasury Securities', '', ' and U.S. Agency Securities', 0),
    ('R5', ('eq', 'Integral multiples of USD 10,000'), 'USD ', '10,000', '50,000', 0),
    ('R7', ('in', 'Credit Agreement, dated as of March 14, 2025'), 'dated as of ', 'March 14, 2025',
     'March 17, 2025', 0),
    ('A15', ('in', 'any privity of contract, third-party'), 'any ', 'privity of contract, ', '', 0),
    ('A16', ('in', 'Jonathan Driscoll, Of Counsel'), 'Jonathan Driscoll, ', 'Of Counsel', 'Partner', 0),
    ('A17', ('in', 'laws of the State of New York, without regard'), 'State of ', 'New York', 'Delaware', 0),
    ('A18', ('in', 'exchange of telexes, electronic messages'), 'exchange of ', 'telexes, ', '', 0),
    ('A19', ('in', 'the same as handwritten signatures'), 'are the ', 'same as', 'equivalent of', 0),
]


def locate(parts, test, nth):
    kind, s = test
    hits = []
    for i in range(1, len(parts), 2):
        t = ptext(parts[i])
        if (t == s) if kind == 'eq' else (s in t):
            hits.append(i)
    if len(hits) <= nth:
        raise SystemExit('change anchor not found: %r' % (s,))
    return hits[nth]


def build_counterparty(src, out, out_expected):
    entries = read_docx(src)
    doc = part(entries, 'word/document.xml')
    assert not re.search(r'<w:(ins|del) ', doc)
    ids = iter(range(1001, 2000))
    results = {}
    for mode in ('track', 'expected'):
        parts = paragraphs(doc)
        paras, order = {}, []
        for label, test, before, deleted, inserted, nth in CHANGES:
            i = locate(parts, test, nth)
            p = paras.setdefault(i, Para(parts[i]))
            t = p.text()
            at = t.find(before + deleted)
            assert at >= 0, (label, before + deleted)
            start = at + len(before)
            order.append((i, start, label, before, deleted, inserted, t))
        # apply from the end of each paragraph so earlier offsets stay valid
        for i, start, label, before, deleted, inserted, t in sorted(order, key=lambda o: (o[0], -o[1])):
            if mode == 'track':
                paras[i].edit(start, start + len(deleted), inserted, (ids, AUTHOR, DATE))
            elif label.startswith('A'):
                paras[i].edit(start, start + len(deleted), inserted)
        for i, p in paras.items():
            parts[i] = p.xml()
            if mode == 'expected':
                assert '  ' not in p.text() and not p.text().startswith(' '), p.text()
        results[mode] = (''.join(parts), sorted(order))
    # renumber ids in document order
    tracked, order = results['track']
    counter = iter(range(1, 1000))
    tracked = re.sub(r'(<w:(?:ins|del) w:id=")\d+"', lambda m: m.group(1) + str(next(counter)) + '"', tracked)
    write_docx(out, replace_part(entries, 'word/document.xml', tracked))
    write_docx(out_expected, replace_part(entries, 'word/document.xml', results['expected'][0]))
    return order


# --- C: stonehill-first-markup-csa, property order fixed ---------------------------------------

BANNER = re.compile(r'<w:ins [^>]*><w:r>(?:(?!</w:r>).)*<w:t[^>]*>(STONEHILL GLOBAL MARKETS AG — FIRST MARKUP|'
                    r'Transmitted July 3, 2025|Tracked Changes Against Velden Capital Partners LP Initial '
                    r'Draft Dated June 16, 2025)</w:t></w:r></w:ins>', re.S)


def build_stonehill(src, out):
    entries = read_docx(src)
    doc = part(entries, 'word/document.xml')
    parts = paragraphs(doc)
    hits = [i for i in range(1, len(parts), 2) if 'FIRST MARKUP' in ptext(parts[i])]
    assert len(hits) == 1
    p = parts[hits[0]]
    p, n = BANNER.subn('', p)
    assert n == 3, n
    # the two space runs that separated the banner lines
    p = re.sub(r'<w:r><w:rPr>(?:(?!</w:r>).)*</w:rPr><w:t xml:space="preserve"> </w:t></w:r>', '', p, flags=re.S)
    assert ptext(p) == '', ptext(p)
    parts[hits[0]] = p
    doc = canonical_order(''.join(parts))
    write_docx(out, replace_part(entries, 'word/document.xml', doc))


def build_msa_redline(src, out):
    """The stale-colleague-edit case's redline: one turn by Eval Reviewer, then a colleague's insertion."""
    entries = read_docx(src)
    doc = part(entries, 'word/document.xml')
    assert not re.search(r'<w:(ins|del) ', doc)
    ids = iter(range(max(int(n) for n in re.findall(r'w:id="(\d+)"', doc)) + 1, 10 ** 6))
    parts = paragraphs(doc)
    for test, before, deleted, inserted, author, date in (
            (('in', 'shall be due within thirty (30) days from the date of the Bill of Lading'),
             'within ', 'thirty (30)', 'forty-five (45)', 'Eval Reviewer', '2026-10-27T09:01:00Z'),
            (('in', 'confirmed by a first-class international bank acceptable to the Seller'),
             'first-class international bank', '', ' rated at least A-', 'Dana Colleague', '2026-10-27T11:00:00Z')):
        i = locate(parts, test, 0)
        p = Para(parts[i])
        start = p.text().index(before + deleted) + len(before)
        p.edit(start, start + len(deleted), inserted, (ids, author, date))
        parts[i] = p.xml()
    write_docx(out, replace_part(entries, 'word/document.xml', ''.join(parts)))


def main():
    fx, long_fx = sys.argv[1], sys.argv[2]
    build_msa_redline(os.path.join(fx, 'master-supply-agreement.docx'),
                      os.path.join(fx, 'master-supply-agreement.redline.docx'))
    log = build_revised(os.path.join(fx, 'greenleaf-marked-confirmation.docx'),
                        os.path.join(fx, 'greenleaf-revised-confirmation.docx'))
    build_counterparty(os.path.join(fx, 'tidemark-draft-confirmation.docx'),
                       os.path.join(fx, 'swap-confirmation-counterparty.docx'),
                       os.path.join(fx, 'swap-confirmation-counterparty.expected.docx'))
    os.makedirs(os.path.join(long_fx, 'long-csa-counter-redline'), exist_ok=True)
    build_stonehill(os.path.join(fx, 'stonehill-first-markup-csa.docx'),
                    os.path.join(long_fx, 'long-csa-counter-redline', 'stonehill-first-markup-csa.docx'))
    if os.environ.get('BUILD_FIXTURES_LOG'):
        print('\n'.join(log))


if __name__ == '__main__':
    main()

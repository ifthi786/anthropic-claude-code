#!/usr/bin/env python3
"""
ARR Dashboard rebuild pipeline.

Reads the "Total Summary" sheet of the ARR tracker workbook, renders the
JavaScript data module that lives inside the <script id="arr-data"> block of
template.html, and swaps that module into the template to produce the final
HTML. Only the *data literals* are generated; the surrounding scaffolding
(comment banner, savingPct line, the formatter functions) is emitted verbatim
to match the template exactly, and every byte outside the data block is copied
through untouched.

Usage:
    # Default: swap the freshly rendered module into the template.
    python rebuild.py --xlsx ARR_-_Tracker.xlsx --template template.html --out index.html

    # Preview just the JS module (also writes module_preview.js).
    python rebuild.py --xlsx ARR_-_Tracker.xlsx --print-module
"""

import argparse
import datetime
import os
import re
import sys

import openpyxl


# ---------------------------------------------------------------------------
# Reading the workbook
# ---------------------------------------------------------------------------

# Total Summary location names -> dashboard keys.
LOCATION_KEYS = {"Abu Dhabi": "ad", "Dubai": "dubai", "RAK": "rak"}

# Excel's 1900 date system epoch (with the well-known leap-year offset).
EXCEL_EPOCH = datetime.datetime(1899, 12, 30)


def _blank(value):
    return value is None or (isinstance(value, str) and value.strip() == "")


def parse_month_cell(value):
    """Coerce a 'Month' cell to a datetime.

    The cell arrives in one of three shapes:
      1) a datetime               -> used directly
      2) a string like "Apr 2026" -> parsed with "%b %Y"
      3) a raw Excel serial number -> EXCEL_EPOCH + that many days
    """
    if isinstance(value, datetime.datetime):
        return value
    if isinstance(value, datetime.date):
        return datetime.datetime(value.year, value.month, value.day)
    if isinstance(value, str):
        return datetime.datetime.strptime(value.strip(), "%b %Y")
    if isinstance(value, (int, float)):
        return EXCEL_EPOCH + datetime.timedelta(days=int(value))
    raise ValueError("Unrecognized month cell: %r" % (value,))


def read_workbook(xlsx_path):
    """Read the 'Total Summary' sheet into a plain dict of raw figures.

    Structural rules (key mapping, name stripping, int() coercion, row
    skipping, sorting, month parsing) are applied here. Numeric rounding for
    the JS literals is left to render_module().
    """
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb["Total Summary"]

    def cell(ref):
        return ws[ref].value

    totals = {
        "awarded": cell("F9"),
        "budgetAwarded": cell("E9"),
        "saving": cell("G9"),
        "packages": int(cell("E30")),
        "budgetOngoing": cell("E14"),
        "budgetProgram": cell("E15"),
    }

    locations = []
    for row in (6, 7, 8):
        name = str(cell("C%d" % row)).strip()
        locations.append({
            "key": LOCATION_KEYS.get(name, name.lower()),
            "name": name,
            "budget": cell("E%d" % row),
            "awarded": cell("F%d" % row),
            "saving": cell("G%d" % row),
            "share": cell("H%d" % row),
        })

    status = []
    for row in (13, 14):
        name = str(cell("C%d" % row)).strip()
        status.append({
            "key": name.lower(),
            "name": name,
            "budget": cell("E%d" % row),
            "awarded": cell("F%d" % row),
            "saving": cell("G%d" % row),
        })

    staff = []
    for row in range(20, 29):
        c = cell("C%d" % row)
        if _blank(c):
            continue
        staff.append({
            "name": str(c).strip(),
            "packages": int(cell("E%d" % row)),
            "awarded": cell("F%d" % row),
            "saving": cell("G%d" % row),
        })
    # Sort by awarded DESCENDING, stably: equal entries (e.g. the zero-awarded
    # Anil / Abeer) keep their original sheet order at the bottom.
    staff.sort(key=lambda s: s["awarded"], reverse=True)

    months = []
    for row in range(34, 45):
        c = cell("C%d" % row)
        f = cell("F%d" % row)
        # Future months carry a label but no value -- skip them.
        if _blank(c) or _blank(f):
            continue
        dt = parse_month_cell(c)
        months.append({
            "label": dt.strftime("%b %Y"),     # e.g. "Dec 2025"
            "short": dt.strftime("%b '%y"),    # e.g. "Dec '25"
            "awarded": f,
            "_dt": dt,
        })
    months.sort(key=lambda m: (m["_dt"].year, m["_dt"].month))
    for m in months:
        del m["_dt"]

    return {
        "totals": totals,
        "locations": locations,
        "status": status,
        "staff": staff,
        "months": months,
    }


# ---------------------------------------------------------------------------
# Rendering the JS data module
# ---------------------------------------------------------------------------
#
# Static scaffolding -- copied verbatim from the <script id="arr-data"> block
# of template.html. run_checks() verifies at runtime that these still match the
# template exactly; only the data literals below the line ever change.

BANNER = '/* AUTO-GENERATED from "Total Summary" sheet. All figures in AED. */'
OPEN_IIFE = "window.ARR = (function () {"
USE_STRICT = '  "use strict";'
SAVINGPCT = "  TOTALS.savingPct = TOTALS.saving / TOTALS.budgetAwarded;"
STAFF_HEADER = "  const STAFF = [   // real data has ~9 entries, sorted by awarded DESCENDING; some may be 0"
MONTHS_HEADER = "  const MONTHS = [  // real data has ~7 entries, chronological, list can grow over time"
FORMATTERS = [
    '  const fmtFull = (n) => "AED " + Math.round(n).toLocaleString("en-US");',
    r'  function fmtCompact(n){const sign=n<0?"-":"";const a=Math.abs(n);let v,s;if(a>=1e9){v=a/1e9;s="B";}else if(a>=1e6){v=a/1e6;s="M";}else if(a>=1e3){v=a/1e3;s="K";}else{return sign+a.toFixed(0);}const num=v>=100?v.toFixed(0):v.toFixed(1);return sign+num.replace(/\.0$/,"")+s;}',
    '  const fmtMoney = (n) => "AED " + fmtCompact(n);',
    '  const fmtPct = (n, d = 1) => (n * 100).toFixed(d) + "%";',
]
RETURN_LINE = "  return { TOTALS, LOCATIONS, STATUS, STAFF, MONTHS, fmtFull, fmtCompact, fmtMoney, fmtPct };"
CLOSE_IIFE = "})();"

# Every fixed line we expect to appear, byte-for-byte, in the template block.
STATIC_LINES = (
    [BANNER, OPEN_IIFE, USE_STRICT, SAVINGPCT, STAFF_HEADER, MONTHS_HEADER]
    + FORMATTERS
    + [RETURN_LINE, CLOSE_IIFE]
)


def jsnum(value, decimals):
    """Round to `decimals` places; emit whole numbers without a trailing '.0'."""
    r = round(float(value), decimals)
    if r == int(r):
        return str(int(r))
    return ("%.*f" % (decimals, r)).rstrip("0").rstrip(".")


def _jsstr(value):
    return '"%s"' % (value,)


def _render_objects(rows, indent="    "):
    """Render a list of objects as column-aligned `{ field:value, ... }` lines.

    `rows` is a list of rows, each a list of pre-formatted "field:value" cell
    strings. Every cell but the last in a row gets a trailing comma; columns
    are left-justified so they line up, matching the template's aligned style.
    """
    if not rows:
        return ""
    ncols = len(rows[0])
    widths = [0] * ncols
    for row in rows:
        for i in range(ncols - 1):                      # last column is never padded
            widths[i] = max(widths[i], len(row[i]) + 1)  # +1 accounts for the comma
    out = []
    for r, row in enumerate(rows):
        parts = []
        for i, cell in enumerate(row):
            if i < ncols - 1:
                parts.append((cell + ",").ljust(widths[i] + 1))
            else:
                parts.append(cell)
        line = indent + "{ " + "".join(parts) + " }"
        if r < len(rows) - 1:
            line += ","
        out.append(line)
    return "\n".join(out)


def _render_totals(t):
    """TOTALS is a fixed two-line object with `key: value` (space) styling."""
    prefix = "  const TOTALS = { "
    cont = " " * len(prefix)   # align the wrapped line under the first field
    line1 = prefix + "awarded: %s, budgetAwarded: %s, saving: %s," % (
        jsnum(t["awarded"], 2), jsnum(t["budgetAwarded"], 2), jsnum(t["saving"], 2))
    line2 = cont + "packages: %s, budgetOngoing: %s, budgetProgram: %s };" % (
        int(t["packages"]), jsnum(t["budgetOngoing"], 2), jsnum(t["budgetProgram"], 2))
    return line1 + "\n" + line2


def _location_cells(data):
    return [[
        "key:" + _jsstr(loc["key"]),
        "name:" + _jsstr(loc["name"]),
        "budget:" + jsnum(loc["budget"], 2),
        "awarded:" + jsnum(loc["awarded"], 2),
        "saving:" + jsnum(loc["saving"], 2),
        "share:" + jsnum(loc["share"], 4),
    ] for loc in data["locations"]]


def _status_cells(data):
    return [[
        "key:" + _jsstr(s["key"]),
        "name:" + _jsstr(s["name"]),
        "budget:" + jsnum(s["budget"], 2),
        "awarded:" + jsnum(s["awarded"], 2),
        "saving:" + jsnum(s["saving"], 2),
    ] for s in data["status"]]


def _staff_cells(data):
    return [[
        "name:" + _jsstr(s["name"]),
        "packages:" + str(int(s["packages"])),
        "awarded:" + jsnum(s["awarded"], 2),
        "saving:" + jsnum(s["saving"], 2),
    ] for s in data["staff"]]


def _month_cells(data):
    return [[
        "label:" + _jsstr(m["label"]),
        "short:" + _jsstr(m["short"]),
        "awarded:" + jsnum(m["awarded"], 2),
    ] for m in data["months"]]


def render_module(data):
    """Render the full <script id="arr-data"> inner JS module as a string."""
    lines = [
        BANNER,
        OPEN_IIFE,
        USE_STRICT,
        _render_totals(data["totals"]),
        SAVINGPCT,
        "  const LOCATIONS = [",
        _render_objects(_location_cells(data)),
        "  ];",
        "  const STATUS = [",
        _render_objects(_status_cells(data)),
        "  ];",
        STAFF_HEADER,
        _render_objects(_staff_cells(data)),
        "  ];",
        MONTHS_HEADER,
        _render_objects(_month_cells(data)),
        "  ];",
    ]
    lines.extend(FORMATTERS)
    lines.append(RETURN_LINE)
    lines.append(CLOSE_IIFE)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------

def read_template_block(template_path):
    """Return the inner text of <script id="arr-data"> from template.html."""
    with open(template_path, encoding="utf-8") as fh:
        html = fh.read()
    start_tag = '<script id="arr-data">'
    i = html.find(start_tag)
    if i == -1:
        return None
    j = html.find("</script>", i)
    if j == -1:
        return None
    return html[i + len(start_tag):j]


def run_checks(data, template_block):
    """Return a list of (label, passed) quick checks."""
    t = data["totals"]
    staff_names = [s["name"] for s in data["staff"]]
    month_labels = [m["label"] for m in data["months"]]
    expected_months = ["Dec 2025", "Jan 2026", "Feb 2026", "Mar 2026",
                       "Apr 2026", "May 2026", "Jun 2026"]

    checks = [
        ("TOTALS.awarded == 345332802.19", round(t["awarded"], 2) == 345332802.19),
        ("TOTALS.packages == 24", t["packages"] == 24),
        ("3 locations", len(data["locations"]) == 3),
        ("2 statuses", len(data["status"]) == 2),
        ("9 staff", len(data["staff"]) == 9),
        ("7 months", len(data["months"]) == 7),
        ("STAFF[0] is Suhail", staff_names[0] == "Suhail"),
        ("last two staff are Anil then Abeer", staff_names[-2:] == ["Anil", "Abeer"]),
        ("Anil & Abeer both zero-awarded",
         data["staff"][-2]["awarded"] == 0 and data["staff"][-1]["awarded"] == 0),
        ('MONTHS run "Dec 2025" .. "Jun 2026" chronologically',
         month_labels == expected_months),
    ]
    if template_block is not None:
        checks.append(("static scaffolding matches template verbatim",
                       all(line in template_block for line in STATIC_LINES)))
    return checks


# ---------------------------------------------------------------------------
# HTML swap (template -> output) + self-test
# ---------------------------------------------------------------------------

# The one-and-only data block. DOTALL so the multi-line inner JS is captured;
# non-greedy so we stop at the first </script>.
ARR_DATA_RE = re.compile(r'(<script id="arr-data">)(.*?)(</script>)', re.DOTALL)

# Internal sentinel used only to compare everything *outside* the block.
_BLOCK_SENTINEL = "\x00ARR-DATA-BLOCK\x00"


def find_arr_data_blocks(html):
    """Return all <script id="arr-data"> match objects in `html`."""
    return list(ARR_DATA_RE.finditer(html))


def swap_arr_data(template_html, module_text):
    """Return `template_html` with the data block's inner content replaced.

    The opening/closing tags and every byte outside the block are preserved
    exactly. Fails loudly unless there is exactly one matching element.
    """
    matches = find_arr_data_blocks(template_html)
    if len(matches) != 1:
        raise RuntimeError(
            'expected exactly one <script id="arr-data"> element in template, '
            "found %d" % len(matches))
    m = matches[0]
    inner = "\n" + module_text + "\n"
    return (template_html[:m.start()]
            + m.group(1) + inner + m.group(3)
            + template_html[m.end():])


def run_self_test(template_html, out_html, data):
    """Validate the swapped output; return (results, summary).

    `results` is a list of (label, passed); `summary` is a one-line string.
    """
    out_blocks = find_arr_data_blocks(out_html)
    exactly_one = len(out_blocks) == 1
    block = out_blocks[0].group(0) if exactly_one else ""

    # Replace the whole block with the same sentinel in both, then the
    # remainders must be byte-for-byte identical.
    t_rest = ARR_DATA_RE.sub(lambda _m: _BLOCK_SENTINEL, template_html)
    o_rest = ARR_DATA_RE.sub(lambda _m: _BLOCK_SENTINEL, out_html)

    results = [
        ("output has exactly one arr-data block", exactly_one),
        ('block contains "window.ARR"', "window.ARR" in block),
        ("block contains headline 345332802.19", "345332802.19" in block),
        ("every byte outside the block is identical to template", t_rest == o_rest),
    ]
    summary = ("SUMMARY: packages=%d  locations=%d  staff=%d  months=%d"
               % (data["totals"]["packages"], len(data["locations"]),
                  len(data["staff"]), len(data["months"])))
    return results, summary


def _print_results(title, checks, stream=sys.stderr):
    """Print a PASS/FAIL block; return True iff all checks passed."""
    print(title, file=stream)
    all_pass = True
    for label, ok in checks:
        print(("PASS" if ok else "FAIL") + "  " + label, file=stream)
        all_pass = all_pass and ok
    print("RESULT: " + ("ALL PASS" if all_pass else "SOME FAILED"), file=stream)
    return all_pass


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Rebuild the ARR dashboard HTML from the Excel tracker.")
    parser.add_argument("--xlsx", required=True,
                        help="Path to the ARR tracker .xlsx")
    parser.add_argument("--template",
                        help="Path to the plain-HTML template (swap mode)")
    parser.add_argument("--out",
                        help="Where to write the rebuilt HTML (swap mode)")
    parser.add_argument("--print-module", action="store_true",
                        help="Instead of swapping, print the JS module to stdout "
                             "(also written to module_preview.js)")
    args = parser.parse_args(argv)

    data = read_workbook(args.xlsx)
    module_text = render_module(data)

    # ---- Mode: --print-module (preview the JS module + data quick-checks) ---
    if args.print_module:
        sys.stdout.write(module_text + "\n")
        with open("module_preview.js", "w", encoding="utf-8") as fh:
            fh.write(module_text + "\n")

        here = os.path.dirname(os.path.abspath(__file__))
        template_path = os.path.join(here, "template.html")
        template_block = (read_template_block(template_path)
                          if os.path.exists(template_path) else None)
        ok = _print_results("--- QUICK CHECKS ---", run_checks(data, template_block))
        if template_block is None:
            print("NOTE  template.html not found; skipped verbatim scaffolding check",
                  file=sys.stderr)
        return 0 if ok else 1

    # ---- Default mode: swap the module into the template, then self-test ----
    if not args.template or not args.out:
        parser.error("default swap mode requires --template and --out "
                     "(or pass --print-module)")

    with open(args.template, encoding="utf-8") as fh:
        template_html = fh.read()
    out_html = swap_arr_data(template_html, module_text)
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(out_html)

    # Re-read what we actually wrote and self-test it.
    with open(args.out, encoding="utf-8") as fh:
        written = fh.read()
    results, summary = run_self_test(template_html, written, data)
    ok = _print_results("--- SELF-TEST ---", results, stream=sys.stdout)
    print(summary)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

"""Build the public help page and printable guide from docs/user-guide.md.
Run with the Codex bundled Python runtime (reportlab), or a dedicated documentation environment.
"""
from pathlib import Path
import html
import re
import shutil
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

root = Path(__file__).resolve().parent.parent
source = (root / 'docs/user-guide.md').read_text(encoding='utf-8')
output = root / 'output/pdf/Thimphu_HomeFinder_User_Guide.pdf'
output.parent.mkdir(parents=True, exist_ok=True)
styles = getSampleStyleSheet()
styles.add(ParagraphStyle('GuideBody', fontName='Helvetica', fontSize=10.5, leading=14.4, spaceAfter=8))
styles.add(ParagraphStyle('GuideTitle', fontName='Helvetica-Bold', fontSize=25, leading=29, spaceAfter=17))
styles.add(ParagraphStyle('GuideHeading', fontName='Helvetica-Bold', fontSize=18, leading=22, spaceAfter=12, keepWithNext=True))
styles.add(ParagraphStyle('GuideSubheading', fontName='Helvetica-Bold', fontSize=12, leading=15, spaceBefore=7, spaceAfter=7, keepWithNext=True))
styles.add(ParagraphStyle('GuideCell', fontName='Helvetica', fontSize=8.8, leading=12))
styles.add(ParagraphStyle('GuideCellCenter', parent=styles['GuideCell'], alignment=TA_CENTER))
styles.add(ParagraphStyle('GuideBullet', parent=styles['GuideBody'], leftIndent=11, firstLineIndent=-9, spaceAfter=5))
story, web = [], []
table_rows = []
def inline(text):
    return html.escape(text).replace('’', "'").replace('–', '-').replace('—', '-')
def flush_table():
    if not table_rows:
        return
    data = [[Paragraph(inline(cell), styles['GuideCell'] if i == 0 else styles['GuideCellCenter']) for i, cell in enumerate(row)] for row in table_rows]
    table = Table(data, colWidths=[202, 55, 55, 102, 90], repeatRows=1, hAlign='LEFT')
    table.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D9D9D9')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e7eee8')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LEFTPADDING', (0, 0), (-1, -1), 7), ('RIGHTPADDING', (0, 0), (-1, -1), 7),
    ]))
    story.extend([table, Spacer(1, 13)])
    web.append('<div class="table-scroll"><table><thead><tr>' + ''.join('<th scope="col">' + inline(c) + '</th>' for c in table_rows[0]) + '</tr></thead><tbody>')
    for row in table_rows[1:]:
        web.append('<tr>' + ''.join(('<th scope="row">' if i == 0 else '<td>') + inline(c) + ('</th>' if i == 0 else '</td>') for i, c in enumerate(row)) + '</tr>')
    web.append('</tbody></table></div>')
    table_rows.clear()

for raw in source.splitlines():
    line = raw.strip()
    if line.startswith('|'):
        if not re.match(r'^\|[\s|:-]+$', line):
            table_rows.append([cell.strip() for cell in line.strip('|').split('|')])
        continue
    flush_table()
    if not line:
        continue
    if line.startswith('# '):
        story.append(Paragraph(inline(line[2:]), styles['GuideTitle']))
        web.append('<h1>' + inline(line[2:]) + '</h1>')
    elif line.startswith('## '):
        title = line[3:]
        if title != 'Getting started':
            story.append(PageBreak())
        story.append(Paragraph(inline(title), styles['GuideHeading']))
        web.append('<h2 id="' + title.lower().replace(' ', '-') + '">' + inline(title) + '</h2>')
    elif line.startswith('### '):
        story.append(Paragraph(inline(line[4:]), styles['GuideSubheading']))
        web.append('<h3>' + inline(line[4:]) + '</h3>')
    elif line.startswith('- '):
        story.append(Paragraph('- ' + inline(line[2:]), styles['GuideBullet']))
        web.append('<p class="help-item">' + inline(line[2:]) + '</p>')
    else:
        story.append(Paragraph(inline(line), styles['GuideBody']))
        web.append('<p>' + inline(line) + '</p>')
flush_table()
def footer(canvas, doc):
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(colors.HexColor('#58645d'))
    canvas.drawString(54, 28, 'Thimphu HomeFinder  |  User guide  |  22 October 2026')
    canvas.drawRightString(558, 28, str(doc.page))
SimpleDocTemplate(str(output), pagesize=letter, leftMargin=54, rightMargin=54, topMargin=42, bottomMargin=48,
    title='Thimphu HomeFinder User Guide', author='Thimphu HomeFinder').build(story, onFirstPage=footer, onLaterPages=footer)
public = root / 'frontend/public'
shutil.copyfile(output, public / 'user-guide.pdf')
navigation = ''.join(f'<a href="#{title.lower().replace(" ", "-")}">{title}</a>' for title in ['Getting started', 'Seekers and visitors', 'Landlords', 'Administrators', 'Inbox and troubleshooting'])
page = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HomeFinder User Guide</title><style>
body{margin:0;background:#faf9f6;color:#233d33;font:16px/1.65 system-ui,sans-serif}main{max-width:900px;margin:auto;padding:32px 24px}a{color:#205c48}nav{display:flex;flex-wrap:wrap;gap:12px 24px;padding:18px 0;border-bottom:1px solid #d5dfd8}h1{font-size:clamp(2rem,5vw,3rem);line-height:1.15}h2{margin-top:2.8rem;font-size:1.9rem}h3{margin-top:1.8rem}.download{display:inline-block;background:#205c48;color:white;padding:10px 18px;border-radius:7px;text-decoration:none}.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse;min-width:620px;font-size:.9rem}th,td{border:1px solid #d5dfd8;padding:12px;text-align:center}th:first-child{text-align:left}thead{background:#e7eee8}.help-item{padding-left:16px;border-left:3px solid #d5dfd8}a:focus-visible{outline:3px solid #b07229;outline-offset:4px}@media print{nav,.download,.back{display:none}body{background:white}main{padding:0}h2,h3{break-after:avoid}table{min-width:0;font-size:10pt}tr{break-inside:avoid}}
</style></head><body><main><a class="back" href="/properties">Back to HomeFinder</a><nav aria-label="Guide sections">''' + navigation + '</nav><p><a class="download" href="/user-guide.pdf" download>Download the PDF guide</a></p>' + '\n'.join(web) + '</main></body></html>'
(public / 'help.html').write_text(page, encoding='utf-8')
print('Generated PDF user guide and public help page.')

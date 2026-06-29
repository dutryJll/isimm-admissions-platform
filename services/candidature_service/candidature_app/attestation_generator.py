"""
Générateur d'attestation individuelle PDF ISIMM
Produit un document officiel pour un seul candidat (Préselection / Sélection).
Utilise ReportLab (déjà installé) + qrcode (déjà installé).
"""

import os
from io import BytesIO
from datetime import date

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph,
        Spacer, HRFlowable, Image,
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm, mm
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

try:
    import qrcode
    QRCODE_AVAILABLE = True
except ImportError:
    QRCODE_AVAILABLE = False

# ── Palette ISIMM ──────────────────────────────────────────────────────────────
if REPORTLAB_AVAILABLE:
    NAVY   = colors.HexColor('#0F1F3D')
    BLUE   = colors.HexColor('#185FA5')
    GREEN  = colors.HexColor('#10B981')
    AMBER  = colors.HexColor('#F59E0B')
    RED    = colors.HexColor('#EF4444')
    MUTED  = colors.HexColor('#64748B')
    BORDER = colors.HexColor('#E2E8F4')
    BG     = colors.HexColor('#F4F7FB')
    WHITE  = colors.white
    BLACK  = colors.black
else:
    NAVY = BLUE = GREEN = AMBER = RED = MUTED = BORDER = BG = WHITE = BLACK = None

_STATUT_MAP = {
    'preselectionne':       ('PRÉSÉLECTIONNÉ',        'green'),
    'selectionne':          ('SÉLECTIONNÉ',            'green'),
    'admis':                ('ADMIS',                  'green'),
    'inscrit':              ('INSCRIT',                'green'),
    'refuse':               ('REFUSÉ',                 'red'),
    'rejete':               ('REFUSÉ',                 'red'),
    'en_attente':           ('EN ATTENTE',             'amber'),
    'en_attente_dossier':   ('EN ATTENTE DOSSIER',     'amber'),
    'sous_examen':          ('SOUS EXAMEN',            'blue'),
    'soumis':               ('SOUMIS',                 'blue'),
    'dossier_depose':       ('DOSSIER DÉPOSÉ',         'blue'),
    'dossier_non_depose':   ('DOSSIER NON DÉPOSÉ',     'amber'),
}

_COLOR_MAP = {
    'green': GREEN,
    'red':   RED,
    'amber': AMBER,
    'blue':  BLUE,
}


def _mask_cin(cin: str) -> str:
    s = str(cin or '').strip()
    if len(s) <= 3:
        return '*' * len(s) or '—'
    return '*' * (len(s) - 3) + s[-3:]


def _build_qr_image(data: str, size_cm: float = 3.2):
    if not QRCODE_AVAILABLE or not REPORTLAB_AVAILABLE:
        return None
    try:
        qr = qrcode.QRCode(
            version=1,
            box_size=10,
            border=2,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
        )
        qr.add_data(data)
        qr.make(fit=True)
        pil_img = qr.make_image(fill_color='black', back_color='white')
        buf = BytesIO()
        pil_img.save(buf, format='PNG')
        buf.seek(0)
        return Image(buf, width=size_cm * cm, height=size_cm * cm)
    except Exception:
        return None


def _logo_image(logo_path, size_cm: float = 2.2):
    if logo_path and os.path.exists(logo_path):
        try:
            return Image(logo_path, width=size_cm * cm, height=size_cm * cm)
        except Exception:
            pass
    return None


class ISIMMAttestationGenerator:
    """
    Génère une attestation PDF individuelle officielle ISIMM.
    Intègre QR Code d'authenticité, données candidat, score OCR.
    """

    def generate(
        self,
        candidature,
        base_url: str = 'http://localhost:4200',
        logo_path: str = None,
        media_root: str = None,
    ) -> tuple:
        """
        Retourne (BytesIO, filepath_or_None).
        """
        if not REPORTLAB_AVAILABLE:
            raise ImportError(
                'reportlab non installe. Executer : pip install reportlab'
            )

        # ── Extraction des données ────────────────────────────────────────────
        candidat  = candidature.candidat
        master    = candidature.master
        concours  = getattr(candidature, 'concours', None)

        nom       = (getattr(candidat, 'last_name',  '') or '').strip()
        prenom    = (getattr(candidat, 'first_name', '') or '').strip()
        cin       = (getattr(candidat, 'cin', '') or '').strip()
        email     = (getattr(candidat, 'email', '') or '').strip()
        numero    = (getattr(candidature, 'numero', '') or str(candidature.id)).strip()
        score_val = float(getattr(candidature, 'score', 0) or 0)
        score_ocr = float(getattr(candidature, 'note_extraite_ocr', 0) or 0)
        statut    = (getattr(candidature, 'statut', 'soumis') or 'soumis').strip()

        if master:
            master_nom  = getattr(master, 'nom', 'Master') or 'Master'
            specialite  = getattr(master, 'specialite', '') or ''
            annee       = getattr(master, 'annee_universitaire', '2025-2026') or '2025-2026'
        elif concours:
            master_nom  = getattr(concours, 'nom', 'Cycle Ingénieur') or 'Cycle Ingénieur'
            specialite  = (getattr(concours, 'conditions_admission', {}) or {}).get('specialite', '') or ''
            annee       = '2025-2026'
        else:
            master_nom  = 'Master / Parcours'
            specialite  = ''
            annee       = '2025-2026'

        today_str = date.today().strftime('%d/%m/%Y')
        statut_label, statut_theme = _STATUT_MAP.get(
            statut.lower(), (statut.upper(), 'blue')
        )
        statut_color = _COLOR_MAP.get(statut_theme, BLUE)

        # ── Données du QR Code ────────────────────────────────────────────────
        verify_url = (
            f'{base_url}/api/candidatures/documents/verifier-liste/'
            f'?dossier={numero}&master={getattr(master, "id", 0)}'
        )
        qr_data = (
            f'ISIMM-ATTESTATION\n'
            f'Dossier: {numero}\n'
            f'Candidat: {nom} {prenom}\n'
            f'CIN: {_mask_cin(cin)}\n'
            f'Master: {master_nom}\n'
            f'Statut: {statut_label}\n'
            f'Score: {score_val:.4f}/20\n'
            f'Date: {today_str}\n'
            f'Verification: {verify_url}'
        )

        styles = self._build_styles()
        buf    = BytesIO()
        doc    = SimpleDocTemplate(
            buf,
            pagesize=A4,
            leftMargin=2 * cm, rightMargin=2 * cm,
            topMargin=1.5 * cm, bottomMargin=2 * cm,
        )
        elements = []

        # ── En-tête 3 colonnes ────────────────────────────────────────────────
        logo_cell = _logo_image(logo_path) or Paragraph('<b>ISIMM</b>', styles['logo_fb'])
        qr_cell   = _build_qr_image(qr_data) or Paragraph('', styles['normal'])

        hdr = Table([[
            logo_cell,
            [
                Paragraph(
                    '<b>INSTITUT SUPÉRIEUR D\'INFORMATIQUE ET DE MATHÉMATIQUES DE MONASTIR</b>',
                    styles['h_inst'],
                ),
                Spacer(1, 3 * mm),
                Paragraph('<b>ATTESTATION D\'ADMISSION</b>', styles['h_title']),
            ],
            [
                Paragraph('<b>GFH FOR 09 / v1</b>', styles['h_ref']),
                Spacer(1, 2 * mm),
                qr_cell,
                Paragraph('Scannez pour vérifier', styles['h_ref_sm']),
            ],
        ]], colWidths=[3 * cm, 11 * cm, 4 * cm])
        hdr.setStyle(TableStyle([
            ('BOX',          (0, 0), (-1, -1), 1.2, NAVY),
            ('INNERGRID',    (0, 0), (-1, -1), 0.5, BORDER),
            ('VALIGN',       (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN',        (0, 0), (0, 0),   'CENTER'),
            ('ALIGN',        (1, 0), (1, 0),   'CENTER'),
            ('ALIGN',        (2, 0), (2, 0),   'CENTER'),
            ('TOPPADDING',   (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING',(0, 0), (-1, -1), 8),
            ('LEFTPADDING',  (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND',   (0, 0), (-1, -1), WHITE),
        ]))
        elements.append(hdr)

        # ── Bandeau statut ────────────────────────────────────────────────────
        elements.append(Spacer(1, 7 * mm))
        statut_tbl = Table(
            [[Paragraph(f'<b>{statut_label}</b>', styles['s_label'])]],
            colWidths=[17 * cm],
        )
        statut_tbl.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, -1), statut_color),
            ('ALIGN',         (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING',    (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(statut_tbl)
        elements.append(Spacer(1, 7 * mm))

        # ── Tableau des informations candidat ─────────────────────────────────
        def _row(lbl, val):
            return [
                Paragraph(f'<b>{lbl}</b>', styles['f_lbl']),
                Paragraph(str(val or '—'), styles['f_val']),
            ]

        master_display = master_nom + (f' — {specialite}' if specialite else '')
        rows = [
            _row('Numéro de dossier',    numero),
            _row('Nom',                  nom),
            _row('Prénom',               prenom),
            _row('N° CIN / Passeport',   _mask_cin(cin)),
            _row('Adresse email',         email),
            _row('Master / Parcours',    master_display),
            _row('Année universitaire',  annee),
            _row('Score calculé',        f'{score_val:.4f} / 20'),
        ]
        if score_ocr and abs(score_ocr - score_val) > 0.01:
            rows.append(_row('Score extrait OCR', f'{score_ocr:.4f} / 20'))

        info_tbl = Table(rows, colWidths=[6.5 * cm, 10.5 * cm])
        info_tbl.setStyle(TableStyle([
            ('ROWBACKGROUNDS', (0, 0), (-1, -1), [WHITE, BG]),
            ('BOX',           (0, 0), (-1, -1), 0.8, BORDER),
            ('INNERGRID',     (0, 0), (-1, -1), 0.5, BORDER),
            ('TOPPADDING',    (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ('LEFTPADDING',   (0, 0), (-1, -1), 8),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 8),
            ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(info_tbl)
        elements.append(Spacer(1, 8 * mm))

        # ── Note légale ───────────────────────────────────────────────────────
        elements.append(HRFlowable(width='100%', thickness=0.6, color=BORDER))
        elements.append(Spacer(1, 3 * mm))
        elements.append(Paragraph(
            'Ce document est une attestation officielle délivrée par l\'ISIMM. '
            'Toute falsification est passible de poursuites judiciaires. '
            'Vérifiez l\'authenticité en scannant le QR Code ci-dessus ou en contactant l\'administration.',
            styles['note'],
        ))
        elements.append(Spacer(1, 8 * mm))

        # ── Bloc signature ────────────────────────────────────────────────────
        sig_tbl = Table([[
            [
                Paragraph('<b>Émis par :</b>', styles['f_lbl']),
                Spacer(1, 2 * mm),
                Paragraph('ISIMM — Service des Admissions', styles['f_val']),
            ],
            [
                Paragraph(f'<b>Date d\'émission :</b> {today_str}', styles['f_lbl']),
                Spacer(1, 12 * mm),
                Paragraph('Cachet et signature :', styles['f_lbl']),
                Paragraph('_______________________________', styles['f_val']),
            ],
        ]], colWidths=[9 * cm, 8 * cm])
        sig_tbl.setStyle(TableStyle([
            ('BOX',           (0, 0), (-1, -1), 0.5, BORDER),
            ('INNERGRID',     (0, 0), (-1, -1), 0.3, BORDER),
            ('TOPPADDING',    (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ('LEFTPADDING',   (0, 0), (-1, -1), 8),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 8),
            ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(sig_tbl)

        doc.build(
            elements,
            onFirstPage=self._footer,
            onLaterPages=self._footer,
        )
        buf.seek(0)

        # ── Sauvegarde sur disque (optionnel) ─────────────────────────────────
        filepath = None
        if media_root:
            folder = os.path.join(media_root, 'attestations')
            os.makedirs(folder, exist_ok=True)
            safe = f'{nom}_{prenom}'.replace(' ', '_').replace('/', '_')
            filename = (
                f'ISIMM_Attestation_{safe}_{numero}'
                f'_{date.today().isoformat()}.pdf'
            )
            filepath = os.path.join(folder, filename)
            content = buf.read()
            buf.seek(0)
            with open(filepath, 'wb') as fh:
                fh.write(content)

        return buf, filepath

    # ── helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _footer(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 7)
        canvas.setFillColor(MUTED)
        canvas.drawCentredString(
            A4[0] / 2, 1.0 * cm,
            f'— Page {doc.page} — Document officiel ISIMM — Ne pas reproduire sans autorisation',
        )
        canvas.restoreState()

    @staticmethod
    def _build_styles() -> dict:
        base = getSampleStyleSheet()
        return {
            'normal':   ParagraphStyle('N',    parent=base['Normal'], fontSize=9),
            'logo_fb':  ParagraphStyle('LF',   parent=base['Normal'], fontSize=14,
                                       fontName='Helvetica-Bold', textColor=NAVY, alignment=TA_CENTER),
            'h_inst':   ParagraphStyle('HI',   parent=base['Normal'], fontSize=9,
                                       fontName='Helvetica-Bold', textColor=NAVY,
                                       alignment=TA_CENTER, leading=13),
            'h_title':  ParagraphStyle('HT',   parent=base['Normal'], fontSize=11,
                                       fontName='Helvetica-Bold', textColor=NAVY, alignment=TA_CENTER),
            'h_ref':    ParagraphStyle('HR',   parent=base['Normal'], fontSize=9,
                                       fontName='Helvetica-Bold', textColor=NAVY, alignment=TA_CENTER),
            'h_ref_sm': ParagraphStyle('HRS',  parent=base['Normal'], fontSize=7,
                                       textColor=MUTED, alignment=TA_CENTER),
            's_label':  ParagraphStyle('SL',   parent=base['Normal'], fontSize=14,
                                       fontName='Helvetica-Bold', textColor=WHITE, alignment=TA_CENTER),
            'f_lbl':    ParagraphStyle('FL',   parent=base['Normal'], fontSize=9,
                                       fontName='Helvetica-Bold', textColor=NAVY),
            'f_val':    ParagraphStyle('FV',   parent=base['Normal'], fontSize=9, textColor=BLACK),
            'note':     ParagraphStyle('FN',   parent=base['Normal'], fontSize=7.5,
                                       textColor=MUTED, leading=11),
        }

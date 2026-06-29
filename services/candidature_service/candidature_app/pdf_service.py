

from io import BytesIO
from datetime import date
import os

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm, mm
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle,
        Paragraph, Spacer, HRFlowable, PageBreak,
        Image, KeepTogether,
    )
    _REPORTLAB_OK = True
except ImportError:
    _REPORTLAB_OK = False

try:
    import qrcode
    from PIL import Image as _PILImage
    _QRCODE_OK = True
except ImportError:
    _QRCODE_OK = False


# ─── Palette ISIMM ────────────────────────────────────────────────────────────

NAVY      = colors.HexColor('#0F1F3D')
BLUE      = colors.HexColor('#185FA5')
BLUE_LT   = colors.HexColor('#2E75B6')
GREEN_DK  = colors.HexColor('#065F46')
GREEN_BG  = colors.HexColor('#D1FAE5')
AMBER_DK  = colors.HexColor('#92400E')
AMBER_BG  = colors.HexColor('#FEF3C7')
MUTED     = colors.HexColor('#64748B')
BORDER    = colors.HexColor('#E2E8F4')
ROW_ALT   = colors.HexColor('#F4F7FB')
WHITE     = colors.white
BLACK     = colors.black


# ─── Helpers QR & Logo ───────────────────────────────────────────────────────

def _build_qr(url: str, size_cm: float = 2.2):
    """Génère un objet Image ReportLab depuis une URL."""
    if not _QRCODE_OK or not url:
        return None
    try:
        qr = qrcode.QRCode(version=1, box_size=10, border=2,
                           error_correction=qrcode.constants.ERROR_CORRECT_M)
        qr.add_data(url)
        qr.make(fit=True)
        img_pil = qr.make_image(fill_color='black', back_color='white')
        buf = BytesIO()
        img_pil.save(buf, format='PNG')
        buf.seek(0)
        return Image(buf, width=size_cm * cm, height=size_cm * cm)
    except Exception:
        return None


def _build_logo(logo_path: str, size_cm: float = 2.0):
    """Charge le logo ISIMM depuis le chemin absolu."""
    if logo_path and os.path.exists(logo_path):
        try:
            return Image(logo_path, width=size_cm * cm, height=size_cm * cm)
        except Exception:
            pass
    return None


def _mask_cin(cin: str) -> str:
    """Masque les premiers caractères du CIN pour conformité RGPD."""
    s = str(cin or '').strip()
    if not s:
        return '—'
    return ('*' * max(0, len(s) - 3)) + s[-3:]


# ─── Styles ──────────────────────────────────────────────────────────────────

def _build_styles() -> dict:
    base = getSampleStyleSheet()
    return {
        'logo_fallback': ParagraphStyle(
            'LF', parent=base['Normal'],
            fontSize=13, fontName='Helvetica-Bold',
            textColor=NAVY, alignment=TA_CENTER,
        ),
        'institution': ParagraphStyle(
            'Inst', parent=base['Normal'],
            fontSize=9, fontName='Helvetica-Bold',
            textColor=NAVY, alignment=TA_CENTER, leading=13,
        ),
        'ref': ParagraphStyle(
            'Ref', parent=base['Normal'],
            fontSize=10, fontName='Helvetica-Bold',
            textColor=NAVY, alignment=TA_CENTER,
        ),
        'ref_small': ParagraphStyle(
            'RefS', parent=base['Normal'],
            fontSize=8, textColor=MUTED, alignment=TA_CENTER,
        ),
        'doc_title': ParagraphStyle(
            'DocTitle', parent=base['Normal'],
            fontSize=13, fontName='Helvetica-Bold',
            textColor=NAVY, alignment=TA_CENTER, spaceAfter=4,
        ),
        'meta': ParagraphStyle(
            'Meta', parent=base['Normal'],
            fontSize=9, textColor=BLACK, leading=14,
        ),
        'section_principale': ParagraphStyle(
            'SecP', parent=base['Normal'],
            fontSize=11, fontName='Helvetica-Bold',
            textColor=GREEN_DK, leading=16,
        ),
        'section_attente': ParagraphStyle(
            'SecA', parent=base['Normal'],
            fontSize=11, fontName='Helvetica-Bold',
            textColor=AMBER_DK, leading=16,
        ),
        'remarque': ParagraphStyle(
            'Rem', parent=base['Normal'],
            fontSize=8, textColor=MUTED, leading=12,
        ),
        'footer_txt': ParagraphStyle(
            'Ft', parent=base['Normal'],
            fontSize=7, textColor=MUTED, alignment=TA_CENTER,
        ),
    }


# ─── En-tête 3 colonnes ──────────────────────────────────────────────────────

def _build_header(styles, logo_path, qr_url, ref_doc='GFH FOR 09', version='v1') -> Table:
    """
    Entête officielle ISIMM à 3 colonnes :
      [Logo ISIMM] | [Nom institution + titre doc] | [Référence GFH + QR code]
    """
    logo_cell = _build_logo(logo_path, size_cm=2.2) or Paragraph(
        '<b>ISIMM</b>', styles['logo_fallback']
    )
    institution_cell = Paragraph(
        '<b>INSTITUT SUPÉRIEUR D\'INFORMATIQUE ET DE<br/>'
        'MATHÉMATIQUES DE MONASTIR</b>',
        styles['institution'],
    )
    ref_items = [Paragraph(f'<b>{ref_doc}</b>', styles['ref'])]
    if version:
        ref_items.append(Paragraph(version, styles['ref_small']))
    qr = _build_qr(qr_url, size_cm=1.8) if qr_url else None
    if qr:
        ref_items.append(qr)

    t = Table([[logo_cell, institution_cell, ref_items]],
              colWidths=[3 * cm, 11 * cm, 4 * cm])
    t.setStyle(TableStyle([
        ('BOX',         (0, 0), (-1, -1), 1.2,  NAVY),
        ('INNERGRID',   (0, 0), (-1, -1), 0.4,  BORDER),
        ('VALIGN',      (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN',       (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING',  (0, 0), (-1, -1), 8),
        ('BOTPADDING',  (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING',(0, 0), (-1, -1), 8),
        ('BACKGROUND',  (0, 0), (-1, -1), WHITE),
    ]))
    return t


# ─── En-tête de section colorée ──────────────────────────────────────────────

def _section_header_principale(styles, nb: int) -> list:
    """Bandeau vert pour LISTE PRINCIPALE."""
    return [
        Spacer(1, 5 * mm),
        KeepTogether([
            Table(
                [[Paragraph(
                    f'LISTE PRINCIPALE — {nb} candidat(s) admis',
                    styles['section_principale'],
                )]],
                colWidths=[18 * cm],
            ),
        ]),
        Spacer(1, 2 * mm),
    ]


def _section_header_attente(styles, nb: int) -> list:
    """Bandeau ambre pour LISTE D'ATTENTE."""
    return [
        Spacer(1, 6 * mm),
        KeepTogether([
            Table(
                [[Paragraph(
                    f'LISTE D\'ATTENTE — {nb} candidat(s)',
                    styles['section_attente'],
                )]],
                colWidths=[18 * cm],
            ),
        ]),
        Spacer(1, 2 * mm),
    ]


# ─── Tableau candidats ────────────────────────────────────────────────────────

def _build_candidates_table(candidats: list, header_bg: colors.HexColor) -> Table:
    """
    Construit le tableau des candidats avec :
      Rang | N° Dossier | Nom | Prénom | CIN (masqué) | Score/20
    """
    entetes = ['Rang', 'N° Dossier', 'Nom', 'Prénom', 'N°CIN', 'Score/20']
    donnees = [entetes]

    candidats_tries = sorted(
        candidats,
        key=lambda c: float(c.get('score') or 0),
        reverse=True,
    )

    for rang, c in enumerate(candidats_tries, start=1):
        score_raw = c.get('score', 0)
        try:
            score_str = f"{float(score_raw):.2f}"
        except (TypeError, ValueError):
            score_str = '—'

        donnees.append([
            str(rang),
            str(c.get('num_dossier') or c.get('numero') or ''),
            str(c.get('nom') or ''),
            str(c.get('prenom') or ''),
            _mask_cin(str(c.get('cin') or '')),
            score_str,
        ])

    col_widths = [1.4 * cm, 3.5 * cm, 3.8 * cm, 3.8 * cm, 3.5 * cm, 2.5 * cm]
    t = Table(donnees, colWidths=col_widths, repeatRows=1)

    style = [
        # Ligne d'en-tête
        ('BACKGROUND',   (0, 0), (-1, 0), header_bg),
        ('TEXTCOLOR',    (0, 0), (-1, 0), WHITE),
        ('FONTNAME',     (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE',     (0, 0), (-1, 0), 9),
        ('ALIGN',        (0, 0), (-1, 0), 'CENTER'),
        ('TOPPADDING',   (0, 0), (-1, 0), 6),
        ('BOTTOMPADDING',(0, 0), (-1, 0), 6),
        # Données
        ('FONTNAME',     (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE',     (0, 1), (-1, -1), 8),
        ('ALIGN',        (0, 1), (-1, -1), 'CENTER'),
        ('VALIGN',       (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING',   (0, 1), (-1, -1), 4),
        ('BOTTOMPADDING',(0, 1), (-1, -1), 4),
        # Lignes alternées
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, ROW_ALT]),
        # Bordures
        ('BOX',          (0, 0), (-1, -1), 0.8, BORDER),
        ('INNERGRID',    (0, 0), (-1, -1), 0.4, BORDER),
        # Score en gras
        ('FONTNAME',     (5, 1), (5, -1), 'Helvetica-Bold'),
    ]

    # Colorier le score selon la valeur (vert ≥ 14, ambre ≥ 10, rouge < 10)
    for i, c in enumerate(candidats_tries, start=1):
        try:
            s = float(c.get('score') or 0)
            if s >= 14.0:
                style.append(('TEXTCOLOR', (5, i), (5, i), GREEN_DK))
            elif s < 10.0:
                style.append(('TEXTCOLOR', (5, i), (5, i), colors.HexColor('#DC2626')))
            else:
                style.append(('TEXTCOLOR', (5, i), (5, i), AMBER_DK))
        except (TypeError, ValueError):
            pass

    t.setStyle(TableStyle(style))
    return t


# ─── Bloc signature ───────────────────────────────────────────────────────────

def _build_signature(styles, selecteur: str, date_str: str) -> list:
    sig = Table([
        [
            Paragraph(f'<b>Établi par :</b> {selecteur}', styles['meta']),
            Paragraph(f'<b>Date :</b> {date_str}', styles['meta']),
        ],
        [
            Paragraph('<b>Président du comité de sélection :</b>', styles['meta']),
            Paragraph('Signature et cachet :', styles['meta']),
        ],
        [
            Paragraph('_______________________________', styles['meta']),
            Paragraph('_______________________________', styles['meta']),
        ],
    ], colWidths=[9 * cm, 9 * cm])
    sig.setStyle(TableStyle([
        ('TOPPADDING',  (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING',(0,0), (-1, -1), 5),
        ('VALIGN',      (0, 0), (-1, -1), 'TOP'),
        ('BOX',         (0, 0), (-1, -1), 0.5, BORDER),
        ('INNERGRID',   (0, 0), (-1, -1), 0.3, BORDER),
    ]))
    return [
        Spacer(1, 8 * mm),
        HRFlowable(width='100%', thickness=0.8, color=NAVY),
        Spacer(1, 4 * mm),
        sig,
    ]


# ─── Callback pied de page avec QR Code ──────────────────────────────────────

class _PageCallback:
    """
    Dessine en bas à droite de chaque page :
      - Numéro de page centré
      - QR Code d'authenticité (vérification en ligne)
    """

    def __init__(self, qr_url: str, date_str: str):
        self.qr_url = qr_url
        self.date_str = date_str
        # Pré-génère l'image QR une seule fois
        self._qr_pil = None
        if _QRCODE_OK and qr_url:
            try:
                qr = qrcode.QRCode(
                    version=1, box_size=8, border=2,
                    error_correction=qrcode.constants.ERROR_CORRECT_M,
                )
                qr.add_data(qr_url)
                qr.make(fit=True)
                self._qr_pil = qr.make_image(fill_color='black', back_color='white')
            except Exception:
                pass

    def __call__(self, canvas, doc):
        canvas.saveState()
        w, h = A4

        # Numérotation centrée
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(MUTED)
        canvas.drawCentredString(w / 2, 0.9 * cm, f'— Page {doc.page} —')

        # Date et référence à gauche
        canvas.setFont('Helvetica', 7)
        canvas.drawString(1.8 * cm, 0.9 * cm, f'ISIMM — {self.date_str}')

        # QR Code en bas à droite (2 × 2 cm)
        if self._qr_pil is not None:
            try:
                buf = BytesIO()
                self._qr_pil.save(buf, format='PNG')
                buf.seek(0)
                qr_size = 2.0 * cm
                canvas.drawImage(
                    buf,
                    x=w - 1.8 * cm - qr_size,
                    y=0.3 * cm,
                    width=qr_size,
                    height=qr_size,
                    preserveAspectRatio=True,
                )
                # Libellé sous le QR
                canvas.setFont('Helvetica', 6)
                canvas.setFillColor(MUTED)
                canvas.drawCentredString(
                    w - 1.8 * cm - qr_size / 2,
                    0.15 * cm,
                    'Vérifier authenticité',
                )
            except Exception:
                pass

        canvas.restoreState()


# ─── Service principal ────────────────────────────────────────────────────────

class ISIMMSelectionPDFService:
    """
    Génère le PDF officiel ISIMM de sélection finale.

    Deux sections distinctes :
      1. LISTE PRINCIPALE  (bandeau vert  — candidats admis)
      2. LISTE D'ATTENTE   (bandeau ambre — candidats en attente)

    QR Code d'authenticité dessiné en bas à droite de chaque page via le
    callback pied de page (hors flux Platypus).
    """

    def generer(
        self,
        candidats_principale: list,
        candidats_attente: list,
        master_nom: str = 'Mastère',
        annee: str = '2025-2026',
        selecteur: str = '',
        qr_url: str = '',
        logo_path: str = None,
        date_selection: str = None,
    ) -> BytesIO:
        """
        Génère et retourne le PDF comme BytesIO.

        Paramètres
        ----------
        candidats_principale : list de dicts
            Clés : num_dossier, nom, prenom, cin, score
        candidats_attente    : list de dicts (même structure)
        master_nom           : nom officiel du master
        annee                : année universitaire ('2025-2026')
        selecteur            : nom du responsable/président
        qr_url               : URL de vérification (intégré dans le QR code)
        logo_path            : chemin absolu vers logo-isimm.png
        date_selection       : date de la sélection (défaut : aujourd'hui)
        """
        if not _REPORTLAB_OK:
            raise ImportError(
                "reportlab n'est pas installé. Exécutez : pip install reportlab"
            )

        if date_selection is None:
            date_selection = date.today().strftime('%d/%m/%Y')

        styles = _build_styles()
        buf = BytesIO()

        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            leftMargin=1.8 * cm,
            rightMargin=1.8 * cm,
            topMargin=1.5 * cm,
            bottomMargin=2.4 * cm,   # espace pour QR + pagination
        )

        callback = _PageCallback(qr_url=qr_url, date_str=date_selection)
        elements = []

        # ── En-tête officielle ISIMM ──────────────────────────────────────────
        elements.append(_build_header(styles, logo_path, qr_url))

        # ── Titre central ─────────────────────────────────────────────────────
        elements += [
            Spacer(1, 5 * mm),
            Paragraph(
                'RÉSULTATS DE SÉLECTION FINALE',
                styles['doc_title'],
            ),
            Spacer(1, 2 * mm),
            Paragraph(f'<b>Master :</b> {master_nom}', styles['meta']),
            Paragraph(f'<b>Année universitaire :</b> {annee}', styles['meta']),
            Paragraph(f'<b>Établi par :</b> {selecteur}', styles['meta']),
            Paragraph(f'<b>Date :</b> {date_selection}', styles['meta']),
            Spacer(1, 4 * mm),
            HRFlowable(width='100%', thickness=0.8, color=NAVY),
        ]

        # ── LISTE PRINCIPALE ──────────────────────────────────────────────────
        if candidats_principale:
            elements += _section_header_principale(styles, len(candidats_principale))
            elements.append(
                _build_candidates_table(candidats_principale, header_bg=NAVY)
            )
        else:
            elements += [
                Spacer(1, 5 * mm),
                Paragraph(
                    'LISTE PRINCIPALE — Aucun candidat admis.',
                    styles['section_principale'],
                ),
            ]

        # ── LISTE D'ATTENTE ───────────────────────────────────────────────────
        if candidats_attente:
            # Nouvelle page pour la liste d'attente si la principale est longue
            if len(candidats_principale) > 15:
                elements.append(PageBreak())
                elements.append(_build_header(styles, logo_path, qr_url))

            elements += _section_header_attente(styles, len(candidats_attente))
            elements.append(
                _build_candidates_table(candidats_attente, header_bg=colors.HexColor('#B45309'))
            )
        else:
            elements += [
                Spacer(1, 5 * mm),
                Paragraph(
                    'LISTE D\'ATTENTE — Aucun candidat en attente.',
                    styles['section_attente'],
                ),
            ]

        # ── Remarques ─────────────────────────────────────────────────────────
        elements += self._build_remarques(styles)

        # ── Signature ─────────────────────────────────────────────────────────
        elements += _build_signature(styles, selecteur, date_selection)

        # ── Construction du PDF ───────────────────────────────────────────────
        doc.build(
            elements,
            onFirstPage=callback,
            onLaterPages=callback,
        )

        buf.seek(0)
        return buf

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _build_remarques(styles: dict) -> list:
        items = [
            '1) Un candidat présélectionné dans plusieurs masters doit soumettre un '
            'seul dossier électronique en indiquant ses préférences.',
            '2) Le dossier complet doit être transmis en un seul fichier PDF nommé : '
            '<b>NOM_PRÉNOM_NumDossier.pdf</b>',
            '3) Pièces obligatoires : formulaire de candidature, CIN, diplômes, '
            'relevés de notes, CV.',
            '4) Les candidats de la liste d\'attente seront contactés en cas de '
            'désistement d\'un candidat principal.',
        ]
        elems = [
            Spacer(1, 5 * mm),
            HRFlowable(width='100%', thickness=0.4, color=BORDER),
            Spacer(1, 3 * mm),
            Paragraph('<b>Remarques importantes :</b>', styles['meta']),
            Spacer(1, 2 * mm),
        ]
        for item in items:
            elems.append(Paragraph(f'• {item}', styles['remarque']))
            elems.append(Spacer(1, 1.5 * mm))
        return elems

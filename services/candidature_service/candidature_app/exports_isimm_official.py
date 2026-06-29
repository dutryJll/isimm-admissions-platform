
from io import BytesIO
from datetime import date
import os

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph,
        Spacer, HRFlowable, PageBreak, Image, KeepTogether
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm, mm
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    REPORTLAB_AVAILABLE = True
except ImportError:
    colors = None  # type: ignore[assignment]
    REPORTLAB_AVAILABLE = False

try:
    import qrcode
    from PIL import Image as PILImage
    QRCODE_AVAILABLE = True
except ImportError:
    QRCODE_AVAILABLE = False


# ─── Palette ISIMM ────────────────────────────────────────────────────────────
if REPORTLAB_AVAILABLE and colors is not None:
    NAVY = colors.HexColor('#0F1F3D')
    BLUE = colors.HexColor('#185FA5')
    BLUE_LT = colors.HexColor('#2E75B6')
    GREEN = colors.HexColor('#10B981')
    MUTED = colors.HexColor('#64748B')
    BORDER = colors.HexColor('#E2E8F4')
    BG = colors.HexColor('#F4F7FB')
    WHITE = colors.white
    BLACK = colors.black
else:
    NAVY = BLUE = BLUE_LT = GREEN = MUTED = BORDER = BG = WHITE = BLACK = None


def _spec_group_key(s: str) -> str:
    """
    Clé de regroupement d'une spécialité, insensible aux accents, apostrophes,
    casse et espaces, et ignorant les mots d'une seule lettre (« d' », « l' »…).

    Objectif : fusionner les variantes orthographiques d'une même spécialité
    pour ne pas éclater la liste en sections d'un seul candidat. Exemple :
      « Génie Logiciel et Systèmes' Information »
      « Génie Logiciel et Systèmes d'Information »
    → même clé « genie logiciel et systemes information ».
    """
    if not s:
        return ''
    import unicodedata as _ud
    norm = _ud.normalize('NFD', s)
    norm = ''.join(ch for ch in norm if _ud.category(ch) != 'Mn')  # retire les accents
    norm = norm.lower()
    for ch in ("'", '’', '`', '´', '"', '-', '/', ',', '.', ';', ':'):
        norm = norm.replace(ch, ' ')
    tokens = [t for t in norm.split() if len(t) > 1]  # retire « d », « l »…
    return ' '.join(tokens)


def _mask_cin(cin: str) -> str:
    """Masque partiellement le CIN/Passeport pour RGPD (affiche les 3 derniers chiffres)."""
    if not cin:
        return '—'
    s = str(cin).strip()
    if len(s) <= 3:
        return '*' * len(s)
    return '*' * (len(s) - 3) + s[-3:]


def _build_qr_image(url: str, size_cm: float = 2.5) -> 'Image | None':
    """Génère un QR code ReportLab depuis une URL."""
    if not QRCODE_AVAILABLE:
        return None
    try:
        qr = qrcode.QRCode(version=1, box_size=10, border=2)
        qr.add_data(url)
        qr.make(fit=True)
        pil_img = qr.make_image(fill_color='black', back_color='white')
        buf = BytesIO()
        pil_img.save(buf, format='PNG')
        buf.seek(0)
        return Image(buf, width=size_cm * cm, height=size_cm * cm)
    except Exception:
        return None


def _get_logo_image(logo_path: str = None, size_cm: float = 2.0) -> 'Image | None':
    """Charge le logo ISIMM s'il existe."""
    if logo_path and os.path.exists(logo_path):
        try:
            return Image(logo_path, width=size_cm * cm, height=size_cm * cm)
        except Exception:
            pass
    return None


def _build_header_table(
    styles: dict,
    logo_path: str = None,
    qr_url: str = None,
    ref_doc: str = 'GFH FOR 09',
    version: str = 'v1',
) -> Table:
    """
    Entête officielle ISIMM à 4 colonnes (format identique au document GFH FOR 09 v1) :
      [Logo ISIMM] | Institution + Titre doc | Référence (GFH FOR 09 v1) | [Logo Université Monastir]
    """
    # ── Logo ISIMM (gauche) ─────────────────────────────────────
    logo_isimm = _get_logo_image(logo_path, size_cm=2.4) or Paragraph(
        '<b>ISIMM</b>', styles['logo_fallback']
    )

    # ── Bloc institution + titre du document (centre-gauche) ────
    import os as _os
    institution_html = (
        '<b>INSTITUT SUPÉRIEUR D\'INFORMATIQUE ET DE<br/>'
        'MATHÉMATIQUES DE MONASTIR</b><br/><br/>'
        '<font size="9">Liste des étudiants présélectionnés pour le Mastère</font>'
    )
    institution_cell = Paragraph(institution_html, styles['header_institution'])

    # ── Référence GFH FOR 09 v1 (centre-droite) ─────────────────
    ref_html = f'<b>{ref_doc}</b><br/><b>{version}</b>'
    ref_cell = Paragraph(ref_html, styles['header_ref'])

    # ── Logo Université de Monastir (droite) ────────────────────
    logo_uni_path = None
    if logo_path:
        uni_candidate = _os.path.join(_os.path.dirname(logo_path), 'logo-universite.png')
        if _os.path.exists(uni_candidate):
            logo_uni_path = uni_candidate
    logo_uni = _get_logo_image(logo_uni_path, size_cm=2.4) or Paragraph(
        '<b>U. Monastir</b>', styles['logo_fallback']
    )

    data = [[logo_isimm, institution_cell, ref_cell, logo_uni]]
    t = Table(data, colWidths=[2.8 * cm, 9 * cm, 3.4 * cm, 2.8 * cm])
    t.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1.2, NAVY),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('BACKGROUND', (0, 0), (-1, -1), WHITE),
    ]))
    return t


def _build_subtitle_block(styles, titre_doc: str, master_nom: str, annee: str,
                           selecteur: str, date_selection: str) -> list:
    """Génère le bloc de titre secondaire du document."""
    return [
        Spacer(1, 6 * mm),
        Paragraph(titre_doc, styles['doc_title']),
        Spacer(1, 3 * mm),
        Paragraph(f'<b>Liste des étudiants présélectionnés pour le Master :</b> {master_nom}', styles['meta']),
        Paragraph(f'<b>Année universitaire :</b> {annee}', styles['meta']),
        Paragraph(f'<b>Sélection réalisée par :</b> {selecteur}', styles['meta']),
        Paragraph(f'<b>Date de la sélection :</b> {date_selection}', styles['meta']),
        Spacer(1, 4 * mm),
    ]


def _build_section_header(styles, numero: int, titre_section: str) -> list:
    return [
        Spacer(1, 4 * mm),
        Paragraph(f'{numero}. {titre_section}', styles['section_title']),
        Spacer(1, 2 * mm),
    ]


def _build_candidates_table(candidates: list) -> Table:
    """
    Tableau des candidats :
    [ Num_dossier | Nom | Prénom | N°CIN/Passeport | Score ]
    """
    headers = ['Num_dossier', 'Nom', 'Prénom', 'N°CIN/Passeport', 'Score']
    data = [headers]
    for c in candidates:
        cin = _mask_cin(str(c.get('cin') or c.get('cin_passeport') or ''))
        score = c.get('score', 0)
        score_str = f"{float(score):.7f}".rstrip('0').rstrip('.')
        data.append([
            str(c.get('num_dossier', '')),
            str(c.get('nom', '')),
            str(c.get('prenom', '')),
            cin,
            score_str,
        ])

    col_widths = [4 * cm, 4 * cm, 4 * cm, 4.5 * cm, 2.5 * cm]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        # Data rows
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (0, 1), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 1), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
        # Alternating rows
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, BG]),
        # Grid
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER),
    ]))
    return t


def _build_signature_block(styles, selecteur: str, date_str: str) -> list:
    sig_data = [
        [
            Paragraph(f'<b>Sélection réalisée par :</b> {selecteur}', styles['meta']),
            Paragraph(f'<b>Date de la sélection :</b> {date_str}', styles['meta']),
        ],
        [
            Paragraph('<b>Sélecteur/Président du comité de sélection :</b>', styles['meta']),
            Paragraph('', styles['meta']),
        ],
        [
            Paragraph('Signature : __________________________', styles['meta']),
            Paragraph('', styles['meta']),
        ],
    ]
    t = Table(sig_data, colWidths=[9 * cm, 9 * cm])
    t.setStyle(TableStyle([
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.3, BORDER),
    ]))
    return [
        Spacer(1, 10 * mm),
        HRFlowable(width='100%', thickness=0.8, color=NAVY),
        Spacer(1, 4 * mm),
        t,
    ]


def _build_styles() -> dict:
    """Crée tous les ParagraphStyle réutilisés dans le document."""
    base = getSampleStyleSheet()
    return {
        'logo_fallback': ParagraphStyle(
            'LogoFallback', parent=base['Normal'],
            fontSize=14, fontName='Helvetica-Bold',
            textColor=NAVY, alignment=TA_CENTER
        ),
        'header_institution': ParagraphStyle(
            'HeaderInstitution', parent=base['Normal'],
            fontSize=9, fontName='Helvetica-Bold',
            textColor=NAVY, alignment=TA_CENTER, leading=13
        ),
        'header_ref': ParagraphStyle(
            'HeaderRef', parent=base['Normal'],
            fontSize=10, fontName='Helvetica-Bold',
            textColor=NAVY, alignment=TA_CENTER
        ),
        'header_ref_small': ParagraphStyle(
            'HeaderRefSmall', parent=base['Normal'],
            fontSize=8, textColor=MUTED, alignment=TA_CENTER
        ),
        'doc_title': ParagraphStyle(
            'DocTitle', parent=base['Normal'],
            fontSize=12, fontName='Helvetica-Bold',
            textColor=NAVY, alignment=TA_CENTER, spaceAfter=6
        ),
        'meta': ParagraphStyle(
            'Meta', parent=base['Normal'],
            fontSize=9, textColor=BLACK, leading=14
        ),
        'section_title': ParagraphStyle(
            'SectionTitle', parent=base['Normal'],
            fontSize=10, fontName='Helvetica-Bold',
            textColor=NAVY, leading=14
        ),
        'remarque': ParagraphStyle(
            'Remarque', parent=base['Normal'],
            fontSize=8, textColor=MUTED, leading=12
        ),
        'footer': ParagraphStyle(
            'Footer', parent=base['Normal'],
            fontSize=8, textColor=MUTED, alignment=TA_CENTER
        ),
    }


class ISIMMPDFGenerator:
    """
    Générateur de PDF officiel ISIMM.

    Endpoint : GET /api/documents/generer-pdf
    Paramètres attendus :
        - etape         : 'PRESELECTION' | 'SELECTION'
        - parcoursId    : int (master_id)
        - specialite    : str (filtre optionnel)
        - annee         : str (ex: '2025-2026')
        - master_nom    : str
        - selecteur     : str (nom du responsable)
        - qr_url        : str (URL de vérification)
        - logo_path     : str (chemin absolu vers le logo)
    """

    def generer(
        self,
        candidates_data: list,
        etape: str = 'PRESELECTION',
        master_nom: str = 'Mastère',
        annee: str = '2025-2026',
        selecteur: str = '',
        specialite_filter: str = '',
        qr_url: str = '',
        logo_path: str = None,
        date_selection: str = None,
        titre_override: str = None,
    ) -> BytesIO:
        """
        Génère le PDF officiel et retourne un BytesIO.

        candidates_data : liste de dicts avec les clés :
            num_dossier, nom, prenom, cin, score, type_candidat ('interne'|'externe'),
            specialite_candidat (optionnel)
        """
        if not REPORTLAB_AVAILABLE:
            raise ImportError('reportlab n\'est pas installé. Exécuter : pip install reportlab')

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
            bottomMargin=2 * cm,
        )

        titre_doc = titre_override or self._get_titre_doc(etape, master_nom, specialite_filter, annee)
        elements = []

        # ── En-tête officielle ────────────────────────────────────────────────
        elements.append(_build_header_table(
            styles, logo_path=logo_path,
            qr_url=qr_url, ref_doc='GFH FOR 09', version='v1'
        ))

        # ── Titre + méta ──────────────────────────────────────────────────────
        elements += _build_subtitle_block(
            styles, titre_doc, master_nom, annee, selecteur, date_selection
        )

        # ── Sections selon filtre ─────────────────────────────────────────────
        if specialite_filter:
            # Liste filtrée sur une seule spécialité
            filtered = [
                c for c in candidates_data
                if (c.get('specialite_candidat') or '').lower() == specialite_filter.lower()
            ]
            sorted_candidates = sorted(filtered, key=lambda c: float(c.get('score') or 0), reverse=True)
            elements += _build_section_header(styles, 1, specialite_filter)
            elements.append(_build_candidates_table(sorted_candidates))
        else:
            # Toute la liste → séparation interne / externe par spécialité
            internes = [c for c in candidates_data if c.get('type_candidat') == 'interne']
            externes = [c for c in candidates_data if c.get('type_candidat') == 'externe']

            section_num = 1
            for spec_group, label_prefix in [
                (internes, 'ISIMM'),
                (externes, 'Hors ISIMM'),
            ]:
                if not spec_group:
                    continue

                # Grouper par spécialité NORMALISÉE : fusionne les variantes
                # orthographiques (accents/apostrophes) d'une même spécialité, afin
                # d'éviter des sections d'un seul candidat dues à de simples fautes
                # de frappe dans les données.
                groups: dict = {}
                for c in spec_group:
                    raw = (c.get('specialite_candidat') or 'Spécialité non renseignée').strip()
                    key = _spec_group_key(raw)
                    grp = groups.setdefault(key, {'label': raw, 'cands': []})
                    grp['cands'].append(c)
                    # Conserver le libellé le plus complet comme titre de section.
                    if len(raw) > len(grp['label']):
                        grp['label'] = raw

                # Afficher d'abord les sections les plus fournies (la liste
                # principale apparaît en tête, plus seulement « Ahmed »).
                ordered_groups = sorted(
                    groups.values(), key=lambda g: len(g['cands']), reverse=True
                )

                for grp in ordered_groups:
                    section_label = f"{label_prefix} : {grp['label']}"
                    sorted_cands = sorted(
                        grp['cands'], key=lambda c: float(c.get('score') or 0), reverse=True
                    )
                    # On NE force PLUS un saut de page par section : plusieurs petites
                    # sections peuvent partager une même page (avant, chaque section
                    # occupait une page entière → des pages « Ahmed seul »). KeepTogether
                    # empêche seulement qu'une section soit coupée en deux.
                    block = _build_section_header(styles, section_num, section_label)
                    block.append(_build_candidates_table(sorted_cands))
                    elements.append(KeepTogether(block))
                    elements.append(Spacer(1, 5 * mm))
                    section_num += 1

        # ── Remarques importantes ─────────────────────────────────────────────
        elements += self._build_remarques(styles)

        # ── Validation / Signature ────────────────────────────────────────────
        elements += _build_signature_block(styles, selecteur, date_selection)

        # ── Numérotation des pages ────────────────────────────────────────────
        doc.build(
            elements,
            onFirstPage=self._add_page_number,
            onLaterPages=self._add_page_number,
        )

        buf.seek(0)
        return buf

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _get_titre_doc(self, etape: str, master_nom: str,
                       specialite_filter: str, annee: str) -> str:
        _labels = {
            'PRESELECTION': 'présélectionnés',
            'SELECTION': 'sélectionnés',
            'MASTER': 'présélectionnés (Master)',
            'INGENIEUR': 'présélectionnés (Ingénieur)',
        }
        base = _labels.get(etape, 'sélectionnés')
        titre = f'Liste des étudiants {base} pour le Master : {master_nom}'
        if specialite_filter:
            titre += f' | Spécialité : {specialite_filter}'
        titre += f' | Année universitaire : {annee}'
        return titre

    def _build_remarques(self, styles: dict) -> list:
        items = [
            '1) Si un candidat est présélectionné dans plusieurs masters, il doit envoyer un seul dossier électronique, en indiquant ses choix de préférence sur le formulaire de choix.',
            '2) Le dossier doit être transmis sous forme d\'un seul fichier PDF nommé : <b>NOM_PRÉNOM_NumDossier.pdf</b>',
            '3) Contenu obligatoire : formulaires de candidature, CIN, diplômes, relevés de notes, CV.',
            '4) Les scores des candidats présélectionnés seront recalculés dans la phase de sélection.',
        ]
        elems = [
            Spacer(1, 6 * mm),
            Paragraph('<b>Remarques importantes :</b>', styles['section_title']),
            Spacer(1, 2 * mm),
        ]
        for item in items:
            elems.append(Paragraph(item, styles['remarque']))
            elems.append(Spacer(1, 1.5 * mm))
        return elems

    @staticmethod
    def _add_page_number(canvas, doc):
        """Pied de page avec numérotation."""
        canvas.saveState()
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(MUTED)
        page_text = f'— Page {doc.page} —'
        canvas.drawCentredString(A4[0] / 2, 1.2 * cm, page_text)
        canvas.restoreState()

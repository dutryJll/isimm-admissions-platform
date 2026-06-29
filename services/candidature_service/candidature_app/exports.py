try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
except ImportError:
    colors = None
from io import BytesIO

try:
    import xlsxwriter
except ImportError:
    xlsxwriter = None

class ExportPDFService:
    
    @staticmethod
    def generer_liste_pdf(liste_admission):
        """Générer PDF de la liste d'admission"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(A4))
        
        elements = []
        styles = getSampleStyleSheet()
        
        titre_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            textColor=colors.HexColor('#1e293b'),
            spaceAfter=30,
            alignment=1
        )
        
        titre = Paragraph(
            f"{liste_admission.get_type_liste_display()} - {liste_admission.master.nom}<br/>"
            f"Itération {liste_admission.iteration} - {liste_admission.annee_universitaire}",
            titre_style
        )
        elements.append(titre)
        elements.append(Spacer(1, 20))
        
        data = [['Position', 'N° Candidature', 'Nom Complet', 'Score', 'Paiement', 'Statut']]
        
        for candidat_liste in liste_admission.candidats.all():
            data.append([
                str(candidat_liste.position),
                candidat_liste.candidature.numero,
                candidat_liste.candidature.candidat.get_full_name(),
                f"{candidat_liste.score:.2f}",
                '✓' if candidat_liste.a_paye else '✗',
                candidat_liste.candidature.get_statut_display()
            ])
        
        table = Table(data, colWidths=[2*cm, 4*cm, 6*cm, 3*cm, 3*cm, 4*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        
        elements.append(table)
        doc.build(elements)
        buffer.seek(0)
        return buffer


class ExportExcelService:
    
    @staticmethod
    def generer_liste_excel(liste_admission):
        """Générer Excel de la liste d'admission"""
        output = BytesIO()
        workbook = xlsxwriter.Workbook(output)
        worksheet = workbook.add_worksheet('Liste Admission')
        
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#1e293b',
            'font_color': 'white',
            'border': 1
        })
        
        cell_format = workbook.add_format({'border': 1})
        
        headers = ['Position', 'N° Candidature', 'CIN', 'Nom', 'Prénom', 
                   'Email', 'Score', 'Paiement', 'Date Paiement', 'Statut']
        
        for col, header in enumerate(headers):
            worksheet.write(0, col, header, header_format)
        
        row = 1
        for candidat_liste in liste_admission.candidats.all():
            candidat = candidat_liste.candidature.candidat
            
            worksheet.write(row, 0, candidat_liste.position, cell_format)
            worksheet.write(row, 1, candidat_liste.candidature.numero, cell_format)
            worksheet.write(row, 2, candidat.cin, cell_format)
            worksheet.write(row, 3, candidat.last_name, cell_format)
            worksheet.write(row, 4, candidat.first_name, cell_format)
            worksheet.write(row, 5, candidat.email, cell_format)
            worksheet.write(row, 6, float(candidat_liste.score), cell_format)
            worksheet.write(row, 7, 'OUI' if candidat_liste.a_paye else 'NON', cell_format)
            worksheet.write(row, 8, 
                          candidat_liste.date_paiement.strftime('%d/%m/%Y') if candidat_liste.date_paiement else '',
                          cell_format)
            worksheet.write(row, 9, candidat_liste.candidature.get_statut_display(), cell_format)
            
            row += 1
        
        worksheet.set_column('A:A', 10)
        worksheet.set_column('B:B', 18)
        worksheet.set_column('C:C', 12)
        worksheet.set_column('D:E', 15)
        worksheet.set_column('F:F', 25)
        
        workbook.close()
        output.seek(0)
        return output
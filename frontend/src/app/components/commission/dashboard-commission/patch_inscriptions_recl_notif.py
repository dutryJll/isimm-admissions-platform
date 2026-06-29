with open('dashboard-commission.html', encoding='utf-8') as f:
    content = f.read()

# ==============================================================
# 8. Inscriptions: rename columns
# ==============================================================

# A) Rename 'N Inscription' -> 'N°INSCRIPTION UNIVERSITAIRE'
content = content.replace(
    '                  <th>N Inscription</th>',
    '                  <th>N°INSCRIPTION UNIVERSITAIRE</th>',
    1
)

# B) Rename 'Master' -> 'Spécialité' in inscription table header
# Need to be specific to avoid replacing other 'Master' occurrences
old_master_th = ('                  <th>CIN</th>\n'
                 '                  <th>Master</th>\n'
                 '                  <th>Dossier</th>')
new_master_th = ('                  <th>CIN</th>\n'
                 '                  <th>Spécialité</th>\n'
                 '                  <th>Dossier</th>')
content = content.replace(old_master_th, new_master_th, 1)

# C) Also rename in table data row (candidate.master -> candidate.specialite display)
content = content.replace(
    '                  <td>{{ candidate.master }}</td>',
    '                  <td>{{ candidate.specialite || candidate.master }}</td>',
    1
)

# D) Replace 'Exporter la selection' button to have dropdown choices
old_export_btn = ('            <button class="ins2-bulk-btn ins2-bulk-dl" type="button" (click)="exportVerifiedInscriptions()">Exporter la selection</button>')
new_export_btn = ('            <div class="cm-generer-wrap">\n'
                  '              <button class="ins2-bulk-btn ins2-bulk-dl" type="button" (click)="ins2ExportOpen = !ins2ExportOpen">\n'
                  '                Exporter la sélection <i class="fas fa-chevron-up" style="font-size:10px;margin-left:4px"></i>\n'
                  '              </button>\n'
                  '              <div class="prs-float-dd" [class.open]="ins2ExportOpen">\n'
                  '                <div class="prs-float-dd-item" (click)="exportVerifiedInscriptions(\'xlsx\');ins2ExportOpen=false">\n'
                  '                  <i class="fas fa-file-excel" style="color:#10B981"></i> Exporter Excel\n'
                  '                </div>\n'
                  '                <div class="prs-float-dd-item" (click)="exportVerifiedInscriptions(\'pdf\');ins2ExportOpen=false">\n'
                  '                  <i class="fas fa-file-pdf" style="color:#A32D2D"></i> Exporter PDF\n'
                  '                </div>\n'
                  '              </div>\n'
                  '            </div>')
content = content.replace(old_export_btn, new_export_btn, 1)

print('N INSCRIPTION UNIVERSITAIRE:', 'N°INSCRIPTION UNIVERSITAIRE' in content)
print('Spécialité col:', 'Spécialité</th>' in content)
print('ins2ExportOpen:', 'ins2ExportOpen' in content)

# ==============================================================
# 9. Réclamation: État field -> select for responsable
# ==============================================================
# Find the réclamation état field in the modal or table
# First let's check what exists around ligne 147
lines = content.split('\n')
for i in range(140, 165):
    print(f'L{i+1}: {lines[i][:120]}')

with open('dashboard-commission.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('Saved step 8.')

with open('dashboard-commission.html', encoding='utf-8') as f:
    content = f.read()

# A) Rename 'Moyenne cursus' -> 'Score'
content = content.replace(
    '                  <th>Moyenne cursus</th>',
    '                  <th>Score</th>',
    1
)

# B) Rename 'Dossier' -> 'Dossier de candidature'
old_th = '                  <th>Dossier</th>\n                  <th>Statut Sélection</th>\n                  <th>Actions</th>'
new_th = '                  <th>Dossier de candidature</th>\n                  <th>Statut Sélection</th>\n                  <th>Actions</th>'
content = content.replace(old_th, new_th, 1)

# C) Replace kebab actions button
old_action = ('                  <td>\n'
              '                    <button class="sel-action-btn" type="button" (click)="voirDossierById(c.id)">\n'
              '                      <i class="fas fa-ellipsis-v"></i>\n'
              '                    </button>\n'
              '                  </td>')
new_action = ('                  <td>\n'
              '                    <button class="sel-action-consult" type="button" (click)="ouvrirDossierOCRById(c.id)">\n'
              '                      <i class="fas fa-file-alt"></i> Consulter dossier\n'
              '                    </button>\n'
              '                  </td>')
content = content.replace(old_action, new_action, 1)

# D) Remove the two checkboxes in sel filter bar
old_chk = ('          <div class="sel-fg" style="justify-content:flex-end;gap:8px">\n'
           '            <label class="sel-check-row">\n'
           '              <input type="checkbox" [(ngModel)]="finalSelectionFilters.preselOnly" (change)="updateFinalSelectionFiltered()" />\n'
           '              Présélectionnés uniquement\n'
           '            </label>\n'
           '            <label class="sel-check-row">\n'
           '              <input type="checkbox" [(ngModel)]="finalSelectionFilters.hideValides" (change)="updateFinalSelectionFiltered()" />\n'
           '              Masquer candidats déjà validés\n'
           '            </label>\n'
           '          </div>')
content = content.replace(old_chk, '', 1)

# E) Remove 'Générer liste' from hero + hero actions
old_hero = ('          <div class="sel-hero-actions">\n'
            '            <button class="sel-btn-repechage" type="button" (click)="repechageAutomatique()">\n'
            '              ⏳ Lancer le Repêchage automatique\n'
            '            </button>\n'
            '            <div style="position:relative">\n'
            '              <button class="sel-btn-generer" type="button" (click)="finalSelectionExportOpen = !finalSelectionExportOpen">\n'
            '                📄 Générer liste ▾\n'
            '              </button>\n'
            '              <div class="sel-hero-dd" [class.open]="finalSelectionExportOpen" (click)="$event.stopPropagation()">\n'
            '                <div class="sel-dd-item" (click)="exportCandidatures(\'specialite\',\'xlsx\');finalSelectionExportOpen=false">\n'
            '                  <i class="fas fa-file-excel"></i> Format Excel (.xlsx)\n'
            '                </div>\n'
            '                <div class="sel-dd-item" (click)="genererPDFOfficielISIMM(\'SELECTION\');finalSelectionExportOpen=false">\n'
            '                  <i class="fas fa-file-pdf"></i> Format PDF ISIMM + QR Code\n'
            '                </div>\n'
            '              </div>\n'
            '            </div>\n'
            '            <button class="sel-btn-publier" type="button" (click)="publierEtNotifier()">\n'
            '              ✓ Publier &amp; Notifier\n'
            '            </button>\n'
            '          </div>')
content = content.replace(old_hero, '', 1)

# F) Add action buttons above filters
old_filters = '        <!-- Filters -->\n        <div class="sel-filter-bar">'
new_filters = ('        <!-- Action buttons row (moved from hero) -->\n'
               '        <div class="sel-action-bar">\n'
               '          <button class="sel-btn-repechage" type="button" (click)="repechageAutomatique()">\n'
               '            ⏳ Lancer le Repêchage automatique\n'
               '          </button>\n'
               '          <button class="sel-btn-publier" type="button" (click)="publierEtNotifier()">\n'
               '            ✓ Publier &amp; Notifier\n'
               '          </button>\n'
               '        </div>\n\n'
               '        <!-- Filters -->\n        <div class="sel-filter-bar">')
content = content.replace(old_filters, new_filters, 1)

# G) Fix select-all checkbox
old_all = '                  <th><input type="checkbox" (change)="finalSelectionTop100On = !finalSelectionTop100On" /></th>'
new_all = '                  <th><input type="checkbox" [checked]="isFinalSelectionAllSelected()" (change)="toggleAllFinalSelection($any($event.target).checked)" /></th>'
content = content.replace(old_all, new_all, 1)

# H) Replace floating banner
old_banner = ('      <!-- Floating banner -->\n'
              '      <div class="sel-float-banner" [class.show]="finalSelectionSelectedIds.size > 0">\n'
              '        <div class="sel-float-count"><strong>{{ finalSelectionSelectedIds.size }}</strong> candidat(s) sélectionné(s)</div>\n'
              '        <div class="sel-float-sep"></div>\n'
              '        <button class="sel-float-btn sel-float-blue" type="button" (click)="openFinalSelectionConsultation()">\n'
              '          ☰ Consulter\n'
              '        </button>\n'
              '        <button class="sel-float-btn sel-float-list" type="button" (click)="exportCandidatures(\'specialite\',\'xlsx\')">\n'
              '          ⚡ Générer liste\n'
              '        </button>\n'
              '        <button class="sel-float-close" type="button" (click)="finalSelectionSelectedIds.clear()">\n'
              '          <i class="fas fa-times"></i>\n'
              '        </button>\n'
              '      </div>')

new_banner = ('      <!-- Floating banner -->\n'
              '      <div class="prs-float-banner" [class.show]="finalSelectionSelectedIds.size > 0">\n'
              '        <div class="prs-float-count">\n'
              '          <strong>{{ finalSelectionSelectedIds.size }}</strong> candidat(s) sélectionné(s)\n'
              '        </div>\n'
              '        <div class="prs-float-sep"></div>\n'
              '        <button class="prs-float-btn prs-float-validate" type="button" (click)="bulkValidateSelection()">\n'
              '          <i class="fas fa-check"></i> Tous Valider\n'
              '        </button>\n'
              '        <button class="prs-float-btn prs-float-consult" type="button" (click)="openFinalSelectionConsultation()">\n'
              '          <i class="fas fa-arrow-right"></i> Consulter\n'
              '        </button>\n'
              '        <div class="prs-float-list-wrap">\n'
              '          <button class="prs-float-btn prs-float-list" type="button" (click)="selGenerateListOpen = !selGenerateListOpen">\n'
              '            <i class="fas fa-bolt"></i> Générer liste\n'
              '            <i class="fas fa-chevron-up" style="font-size:10px;margin-left:2px"></i>\n'
              '          </button>\n'
              '          <div class="prs-float-dd" [class.open]="selGenerateListOpen">\n'
              '            <div class="prs-float-dd-item" (click)="exportCandidatures(\'specialite\',\'xlsx\');selGenerateListOpen=false">\n'
              '              <i class="fas fa-file-excel" style="color:#10B981"></i> Format Excel (.xlsx)\n'
              '            </div>\n'
              '            <div class="prs-float-dd-item" (click)="genererPDFOfficielISIMM(\'SELECTION\');selGenerateListOpen=false">\n'
              '              <i class="fas fa-file-pdf" style="color:#A32D2D"></i> Format PDF officiel ISIMM (GFH FOR 09)\n'
              '            </div>\n'
              '          </div>\n'
              '        </div>\n'
              '        <button class="prs-float-close" type="button" (click)="finalSelectionSelectedIds.clear()">\n'
              '          <i class="fas fa-times"></i>\n'
              '        </button>\n'
              '      </div>')

replaced = content.replace(old_banner, new_banner, 1)
if replaced == content:
    print('ERROR: banner not found')
else:
    content = replaced
    print('Banner replaced OK')

print('Score col:', '<th>Score</th>' in content)
print('Dossier de candidature:', 'Dossier de candidature' in content)
print('sel-action-consult:', 'sel-action-consult' in content)
print('Checkboxes removed:', 'Présélectionnés uniquement' not in content)
print('sel-action-bar:', 'sel-action-bar' in content)
print('isFinalSelectionAllSelected:', 'isFinalSelectionAllSelected' in content)
print('selGenerateListOpen:', 'selGenerateListOpen' in content)

with open('dashboard-commission.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done.')

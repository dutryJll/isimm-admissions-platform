# Renommage des pièces du dossier vers la liste officielle ISIMM

from django.db import migrations, models


# Mapping des anciens codes vers les nouveaux codes officiels
RENAME_MAP = {
    'diplome': 'diplomes_bac',
    'releve_notes': 'releves_bac',
    'lettre_motivation': 'formulaire_candidature',
    'certificat_langue': 'attestation_retrait',
    'attestation_travail': 'attestation_retrait',
    # 'cv' -> 'cv' (inchangé)
}


def renommer_codes(apps, schema_editor):
    DocumentType = apps.get_model('candidature_app', 'DocumentType')
    for ancien, nouveau in RENAME_MAP.items():
        for dt in DocumentType.objects.filter(type_document=ancien):
            # éviter les collisions unique_together (master, type_document)
            if DocumentType.objects.filter(master=dt.master, type_document=nouveau).exists():
                continue
            dt.type_document = nouveau
            dt.save(update_fields=['type_document'])


def reverse_noop(apps, schema_editor):
    # Pas de retour en arrière automatique (les anciens codes ont fusionné)
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('candidature_app', '0028_documenttype_rename_to_isimm'),
    ]

    operations = [
        migrations.AlterField(
            model_name='documenttype',
            name='type_document',
            field=models.CharField(
                choices=[
                    ('formulaire_candidature', 'Les formulaires de candidature aux masters'),
                    ('cin', "Copie de la Carte d'Identité Nationale (CIN)"),
                    ('diplomes_bac', "Diplômes obtenus depuis l'année du baccalauréat"),
                    ('releves_bac', "Relevés de notes depuis l'année du baccalauréat"),
                    ('attestation_retrait', "Attestation(s) de retrait d'inscription et/ou de réorientation (le cas échéant)"),
                    ('cv', 'Curriculum Vitae (CV)'),
                ],
                max_length=50,
            ),
        ),
        migrations.RunPython(renommer_codes, reverse_noop),
    ]

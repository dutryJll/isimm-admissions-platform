# Generated migration to rename DocumentType.TYPE_CHOICES to official ISIMM types
# Removes 'autre' type and updates all related records

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('candidature_app', '0027_candidature_date_saisie_inscription_and_more'),
    ]

    operations = [
        # First, handle any existing 'autre' entries by converting them to 'diplome'
        # This is a data migration that runs before the field change
        migrations.RunPython(
            code=lambda apps, schema_editor: convert_autre_documents(apps, schema_editor),
            reverse_code=lambda apps, schema_editor: None,  # No reverse needed for this one-way change
            elidable=False,
        ),

        # Update the field choices for DocumentType.type_document
        migrations.AlterField(
            model_name='documenttype',
            name='type_document',
            field=models.CharField(
                choices=[
                    ('diplome', 'Diplôme'),
                    ('releve_notes', 'Relevé de notes'),
                    ('cv', 'Curriculum Vitae'),
                    ('lettre_motivation', 'Lettre de motivation'),
                    ('certificat_langue', 'Certificat de langue'),
                    ('attestation_travail', 'Attestation de travail'),
                ],
                max_length=50
            ),
        ),
    ]


def convert_autre_documents(apps, schema_editor):
    """Convert any DocumentType entries with 'autre' to 'diplome'"""
    DocumentType = apps.get_model('candidature_app', 'DocumentType')
    DocumentType.objects.filter(type_document='autre').update(type_document='diplome')

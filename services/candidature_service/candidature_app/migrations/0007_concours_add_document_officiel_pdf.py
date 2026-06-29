from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('candidature_app', '0006_configurationappel_add_capacity_pdf_visibility'),
    ]

    operations = [
        migrations.AddField(
            model_name='concours',
            name='document_officiel_pdf',
            field=models.FileField(blank=True, null=True, upload_to='offres/'),
        ),
    ]

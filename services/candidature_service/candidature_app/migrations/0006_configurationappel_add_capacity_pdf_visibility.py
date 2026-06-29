# Generated migration for adding capacity and PDF fields to ConfigurationAppel

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('candidature_app', '0005_notification'),
    ]

    operations = [
        migrations.AddField(
            model_name='configurationappel',
            name='capacite_interne',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='configurationappel',
            name='capacite_externe',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='configurationappel',
            name='document_officiel_pdf',
            field=models.FileField(blank=True, null=True, upload_to='offres/'),
        ),
        migrations.AddField(
            model_name='configurationappel',
            name='est_cache',
            field=models.BooleanField(default=False),
        ),
    ]

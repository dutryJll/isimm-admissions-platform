from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('candidature_app', '0009_document_documenttype_dossier_validationdocument_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='OffreMaster',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('titre', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('capacite', models.IntegerField(default=30)),
                ('date_limite', models.DateField()),
                ('actif', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('master', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='offre_master', to='candidature_app.master')),
            ],
            options={
                'ordering': ['date_limite', 'titre'],
            },
        ),
        migrations.AddIndex(
            model_name='offremaster',
            index=models.Index(fields=['actif', 'date_limite'], name='candidature_actif_72bbfd_idx'),
        ),
    ]

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('candidature_app', '0007_concours_add_document_officiel_pdf'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='InscriptionRapprochementAudit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source_filename', models.CharField(blank=True, max_length=255)),
                ('total_rows', models.PositiveIntegerField(default=0)),
                ('valide_rows', models.PositiveIntegerField(default=0)),
                ('incoherent_rows', models.PositiveIntegerField(default=0)),
                ('absent_rows', models.PositiveIntegerField(default=0)),
                ('payload_rows', models.JSONField(blank=True, default=list)),
                ('result_rows', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'created_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='inscription_rapprochements',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'master',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='inscription_rapprochements',
                        to='candidature_app.master',
                    ),
                ),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='inscriptionrapprochementaudit',
            index=models.Index(fields=['created_at'], name='insc_rappr_created_idx'),
        ),
    ]

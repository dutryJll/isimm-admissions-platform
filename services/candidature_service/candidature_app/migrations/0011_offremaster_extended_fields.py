from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('candidature_app', '0010_offremaster'),
    ]

    operations = [
        migrations.AddField(
            model_name='offremaster',
            name='appel_actif',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='offremaster',
            name='capacites_detaillees',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='offremaster',
            name='date_debut_visibilite',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='offremaster',
            name='date_fin_visibilite',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='offremaster',
            name='date_limite_depot_dossier',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='offremaster',
            name='date_limite_preinscription',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='offremaster',
            name='est_publiee',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='offremaster',
            name='type_formation',
            field=models.CharField(default='master', max_length=30),
        ),
    ]

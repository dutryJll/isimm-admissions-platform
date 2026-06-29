from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('candidature_app', '0002_add_concours_fk_to_candidature'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='master',
            index=models.Index(fields=['actif', 'date_limite_candidature'], name='candidature__actif_ae24a6_idx'),
        ),
        migrations.AddIndex(
            model_name='configurationappel',
            index=models.Index(fields=['actif', 'date_limite_preinscription'], name='candidature__actif_b6f7a7_idx'),
        ),
        migrations.AddIndex(
            model_name='configurationappel',
            index=models.Index(fields=['date_debut_visibilite', 'date_fin_visibilite'], name='candidature__date_de_7f35e7_idx'),
        ),
        migrations.AddIndex(
            model_name='candidature',
            index=models.Index(fields=['candidat', 'statut'], name='candidature__candid_5dd8d6_idx'),
        ),
        migrations.AddIndex(
            model_name='candidature',
            index=models.Index(fields=['master', 'statut'], name='candidature__master__7752df_idx'),
        ),
        migrations.AddIndex(
            model_name='candidature',
            index=models.Index(fields=['statut', 'date_soumission'], name='candidature__statut_4f743c_idx'),
        ),
        migrations.AddIndex(
            model_name='candidature',
            index=models.Index(fields=['concours', 'statut'], name='candidature__concour_0ab4d0_idx'),
        ),
        migrations.AddIndex(
            model_name='concours',
            index=models.Index(fields=['actif', 'date_cloture'], name='candidature__actif_f2da0b_idx'),
        ),
    ]

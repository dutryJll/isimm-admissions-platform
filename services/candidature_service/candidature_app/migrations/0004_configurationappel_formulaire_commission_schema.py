from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('candidature_app', '0003_add_performance_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='configurationappel',
            name='formulaire_commission_schema',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]

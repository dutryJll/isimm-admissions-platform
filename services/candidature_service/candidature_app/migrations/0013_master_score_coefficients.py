from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('candidature_app', '0012_historiqueactioncommission'),
    ]

    operations = [
        migrations.AddField(
            model_name='master',
            name='bonus_mention',
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=5),
        ),
        migrations.AddField(
            model_name='master',
            name='coeff_bac',
            field=models.DecimalField(decimal_places=2, default=0.4, max_digits=5),
        ),
        migrations.AddField(
            model_name='master',
            name='coeff_examen',
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=5),
        ),
        migrations.AddField(
            model_name='master',
            name='coeff_licence',
            field=models.DecimalField(decimal_places=2, default=0.6, max_digits=5),
        ),
    ]

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('candidature_app', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='candidature',
            name='concours',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='candidatures_concours',
                to='candidature_app.concours',
            ),
        ),
    ]

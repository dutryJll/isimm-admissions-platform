from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('candidature_app', '0004_configurationappel_formulaire_commission_schema'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('titre', models.CharField(max_length=255)),
                ('message', models.TextField()),
                ('type', models.CharField(choices=[('info', 'Information'), ('success', 'Succès'), ('warning', 'Avertissement'), ('danger', 'Danger')], default='info', max_length=20)),
                ('lue', models.BooleanField(default=False)),
                ('dedup_key', models.CharField(blank=True, max_length=255, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='notification',
            constraint=models.UniqueConstraint(fields=('user', 'dedup_key'), name='unique_notification_dedup_per_user'),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['user', 'lue', 'created_at'], name='candidature__user_id_56f820_idx'),
        ),
    ]

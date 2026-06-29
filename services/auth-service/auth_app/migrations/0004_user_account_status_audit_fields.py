from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('auth_app', '0003_actionrole'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='reactivated_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Date réactivation'),
        ),
        migrations.AddField(
            model_name='user',
            name='reactivated_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reactivated_users', to='auth_app.user', verbose_name='Réactivé par'),
        ),
        migrations.AddField(
            model_name='user',
            name='suspended_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Date suspension'),
        ),
        migrations.AddField(
            model_name='user',
            name='suspended_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='suspended_users', to='auth_app.user', verbose_name='Suspendu par'),
        ),
        migrations.AddField(
            model_name='user',
            name='suspension_reason',
            field=models.TextField(blank=True, default='', verbose_name='Raison suspension'),
        ),
    ]

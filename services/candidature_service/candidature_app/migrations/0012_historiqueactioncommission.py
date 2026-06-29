from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('candidature_app', '0011_offremaster_extended_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='HistoriqueActionCommission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(max_length=120)),
                ('specialite', models.CharField(max_length=200)),
                ('session', models.CharField(default='', max_length=20)),
                ('nb_candidats', models.PositiveIntegerField(default=0)),
                ('date_action', models.DateTimeField(auto_now_add=True)),
                ('master', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='commission_action_history', to='candidature_app.master')),
                ('responsable', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='commission_action_history', to='auth.user')),
            ],
            options={
                'verbose_name': 'Historique Action Commission',
                'verbose_name_plural': 'Historique des Actions Commission',
                'ordering': ['-date_action'],
            },
        ),
    ]
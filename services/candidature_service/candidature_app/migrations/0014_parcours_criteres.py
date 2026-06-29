# Generated manually: add ParcoursAdmission, CritereEvaluation, ValeurCritere
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('candidature_app', '0013_master_score_coefficients'),
    ]

    operations = [
        migrations.CreateModel(
            name='CritereEvaluation',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=100, unique=True)),
                ('nom', models.CharField(max_length=200, help_text="Nom du champ tel qu'il apparaît dans le payload (ex: 'moyenne_bac')")),
                ('label', models.CharField(blank=True, max_length=200)),
                ('description', models.TextField(blank=True)),
            ],
        ),
        migrations.CreateModel(
            name='ParcoursAdmission',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom', models.CharField(max_length=200)),
                ('actif', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('master', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='parcours_admissions', to='candidature_app.master')),
            ],
            options={
                'ordering': ['-updated_at'],
            },
        ),
        migrations.CreateModel(
            name='ValeurCritere',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('coefficient', models.DecimalField(decimal_places=3, default=1.0, max_digits=6)),
                ('critere', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='candidature_app.critereevaluation')),
                ('parcours', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='valeurs', to='candidature_app.parcoursadmission')),
            ],
            options={
                'unique_together': {('parcours', 'critere')},
            },
        ),
    ]

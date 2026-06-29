from .settings import *

# Test-specific overrides to make async tasks run synchronously during tests
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
# Compatibility aliases
TASK_ALWAYS_EAGER = True
task_always_eager = True

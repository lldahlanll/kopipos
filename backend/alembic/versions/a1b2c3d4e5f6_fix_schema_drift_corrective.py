# File: alembic/versions/a1b2c3d4e5f6_fix_schema_drift_corrective.py
"""fix schema drift - corrective migration for out-of-sync alembic history

Revision ID: a1b2c3d4e5f6
Revises: e2c9a63d91b4
Create Date: 2026-07-08 00:00:00.000000

This migration exists because alembic_version in production pointed to an
orphaned revision (2ebd1f27b486) not present in any migration file or git
history. Investigation via information_schema confirmed the actual schema
state was a mix of applied/unapplied changes across multiple migration
files (likely from Base.metadata.create_all() being used alongside Alembic
at some point). All operations below use idempotent guards (IF NOT EXISTS /
inspector checks) so this migration is safe to run regardless of prior
partial state, and safe to re-run if needed.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'e2c9a63d91b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()

    # 1. table: product_modifiers (confirmed missing)
    op.execute("""
        CREATE TABLE IF NOT EXISTS product_modifiers (
            product_id INTEGER NOT NULL,
            modifier_id INTEGER NOT NULL,
            PRIMARY KEY (product_id, modifier_id),
            FOREIGN KEY (modifier_id) REFERENCES modifiers(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )
    """)

    # 2. order_audit_logs.is_reviewed (confirmed missing)
    op.execute("""
        ALTER TABLE order_audit_logs
        ADD COLUMN IF NOT EXISTS is_reviewed BOOLEAN
    """)

    # 3. categories.sort_order (confirmed missing)
    op.execute("""
        ALTER TABLE categories
        ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0
    """)

    # 4. products.sort_order (confirmed missing)
    op.execute("""
        ALTER TABLE products
        ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0
    """)

    # 5. modifiers.sort_order (confirmed missing)
    op.execute("""
        ALTER TABLE modifiers
        ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TABLE modifiers DROP COLUMN IF EXISTS sort_order")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS sort_order")
    op.execute("ALTER TABLE categories DROP COLUMN IF EXISTS sort_order")
    op.execute("ALTER TABLE order_audit_logs DROP COLUMN IF EXISTS is_reviewed")
    op.execute("DROP TABLE IF EXISTS product_modifiers")
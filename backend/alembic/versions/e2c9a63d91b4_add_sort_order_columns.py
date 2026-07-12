"""add sort_order columns

Revision ID: e2c9a63d91b4
Revises: db3d43b7d4b3
Create Date: 2026-07-08 22:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2c9a63d91b4'
down_revision: Union[str, Sequence[str], None] = 'db3d43b7d4b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0")
        op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0")
        op.execute("ALTER TABLE modifier_groups ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0")
        op.execute("ALTER TABLE modifiers ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0")
        op.execute("ALTER TABLE product_modifier_groups ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0")
    else:
        # Untuk SQLite/lainnya, langsung tambahkan kolom
        op.add_column('categories', sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'))
        op.add_column('products', sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'))
        op.add_column('modifier_groups', sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'))
        op.add_column('modifiers', sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'))
        op.add_column('product_modifier_groups', sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TABLE categories DROP COLUMN IF EXISTS sort_order")
        op.execute("ALTER TABLE products DROP COLUMN IF EXISTS sort_order")
        op.execute("ALTER TABLE modifier_groups DROP COLUMN IF EXISTS sort_order")
        op.execute("ALTER TABLE modifiers DROP COLUMN IF EXISTS sort_order")
        op.execute("ALTER TABLE product_modifier_groups DROP COLUMN IF EXISTS sort_order")
    else:
        op.drop_column('categories', 'sort_order')
        op.drop_column('products', 'sort_order')
        op.drop_column('modifier_groups', 'sort_order')
        op.drop_column('modifiers', 'sort_order')
        op.drop_column('product_modifier_groups', 'sort_order')

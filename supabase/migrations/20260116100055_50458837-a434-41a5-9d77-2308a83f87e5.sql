-- Add soft delete columns to transferencias table
ALTER TABLE transferencias 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID NULL,
ADD COLUMN IF NOT EXISTS deleted_reason TEXT NULL;
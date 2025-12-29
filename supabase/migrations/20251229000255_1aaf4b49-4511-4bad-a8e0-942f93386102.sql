-- Create unique constraint for period_metrics upserts
ALTER TABLE period_metrics 
ADD CONSTRAINT period_metrics_unique_entity 
UNIQUE (project_id, period_key, entity_type, entity_id);
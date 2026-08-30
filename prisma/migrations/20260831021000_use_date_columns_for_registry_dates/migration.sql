ALTER TABLE "RegistryRecord"
ALTER COLUMN "invoice_date" TYPE DATE USING "invoice_date"::DATE,
ALTER COLUMN "registration_date" TYPE DATE USING "registration_date"::DATE;

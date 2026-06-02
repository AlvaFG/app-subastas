-- Add temporal column to pujos so bid order is explicit and the winner is
-- determined with a real timestamp tie-break (BLOG-02 / REQ-09).

IF COL_LENGTH('pujos', 'fechaPuja') IS NULL
  ALTER TABLE pujos ADD fechaPuja DATETIME NOT NULL CONSTRAINT df_pujos_fechaPuja DEFAULT GETDATE();
GO

-- @DOWN
IF OBJECT_ID('df_pujos_fechaPuja', 'D') IS NOT NULL
  ALTER TABLE pujos DROP CONSTRAINT df_pujos_fechaPuja;
GO
IF COL_LENGTH('pujos', 'fechaPuja') IS NOT NULL
  ALTER TABLE pujos DROP COLUMN fechaPuja;
GO

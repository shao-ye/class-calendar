-- 迁移：引入「计费方式」与单节花费
-- 说明：schema.sql 用 CREATE TABLE IF NOT EXISTS，无法给已有表补列，已部署的库需执行本迁移。
--      新库由 schema.sql 直接建出这些列，无需再跑此脚本。
--
-- 本地执行：npx wrangler d1 execute class_calendar --local  --file=./migrations/002_add_billing_mode.sql
-- 线上执行：npx wrangler d1 execute class_calendar --remote --file=./migrations/002_add_billing_mode.sql

-- 1) 课程：计费方式 + 单节默认价
ALTER TABLE courses ADD COLUMN bill_mode TEXT NOT NULL DEFAULT 'none';  -- package / per_session / none
ALTER TABLE courses ADD COLUMN default_fee REAL;                        -- 单节默认价（仅单节付费用，可空）

-- 2) 记录：本节实际花费（仅单节付费写入）
ALTER TABLE records ADD COLUMN fee REAL;

-- 3) 既有数据回填：原 track_hours=1（课时包）→ package；其余 → none（学校课/不计费）
--    原来归为「学校课」的课程，若实际是单节付费，迁移后在课程设置里改成「单节付费」即可。
UPDATE courses SET bill_mode = CASE WHEN track_hours = 1 THEN 'package' ELSE 'none' END;

-- 迁移：为课程表新增「备注」字段
-- 说明：schema.sql 用 CREATE TABLE IF NOT EXISTS，无法给已有表补列，
--      已部署的数据库需单独执行本迁移。新库由 schema.sql 直接建出该列，无需再跑此脚本。
--
-- 本地执行：npx wrangler d1 execute class_calendar --local  --file=./migrations/001_add_course_note.sql
-- 线上执行：npx wrangler d1 execute class_calendar --remote --file=./migrations/001_add_course_note.sql

ALTER TABLE courses ADD COLUMN note TEXT;  -- 课程备注（如上课地点、老师、注意事项等）

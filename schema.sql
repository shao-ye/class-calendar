-- 课程小日历 数据库结构（D1 / SQLite）
-- 设计原则：一期即按多用户结构建表（业务表带 user_id），认证方式独立成表（为微信登录预留）

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,          -- 登录用户名
  password_hash TEXT,                          -- 密码哈希（微信用户可为空）
  display_name  TEXT,                          -- 昵称
  avatar_url    TEXT,                          -- 头像
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 认证身份表（一个用户可绑定多种登录方式，为微信预留）
-- provider: 'password' | 'wechat' | 'wechat_mp' ...
CREATE TABLE IF NOT EXISTS auth_identities (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  provider      TEXT NOT NULL,
  provider_uid  TEXT NOT NULL,                 -- password 方式存 username；wechat 存 openid
  union_id      TEXT,                          -- 微信 unionid，预留
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE (provider, provider_uid)
);

-- 课程库（按用户隔离）
CREATE TABLE IF NOT EXISTS courses (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL,
  name             TEXT NOT NULL,
  color            TEXT NOT NULL DEFAULT '#3b6cff',
  default_start    TEXT,                        -- 默认开始时间 HH:MM
  default_duration INTEGER DEFAULT 60,          -- 默认时长(分钟)
  weekdays         TEXT,                        -- 上课星期 "2,4"（1=周一…7=周日）
  skip_holiday     INTEGER NOT NULL DEFAULT 1,  -- 遇法定假日是否跳过排课
  track_hours      INTEGER NOT NULL DEFAULT 0,  -- 是否走课时包（= bill_mode 为 package；保留以兼容既有扣课时/排课逻辑）
  bill_mode        TEXT NOT NULL DEFAULT 'none',-- 计费方式：package 课时包 / per_session 单节付费 / none 不计费
  default_fee      REAL,                        -- 单节默认价（仅单节付费用，可空，录入记录时自动带出）
  note             TEXT,                        -- 课程备注（如上课地点、老师、注意事项等）
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE (user_id, name)
);

-- 课时包（循环统计：一门课可有多个包，同时仅一个 active）
CREATE TABLE IF NOT EXISTS course_packages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id     INTEGER NOT NULL,
  total_hours   REAL NOT NULL,                 -- 购买总课时
  opening_used  REAL NOT NULL DEFAULT 0,       -- 期初已用（中途接入/手动校正基线）
  purchase_date TEXT,                          -- 购买日期 YYYY-MM-DD
  amount        REAL,                          -- 金额
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'active', -- active 生效 / done 已用完
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- 上课记录（一条 = 一节课，按用户隔离）
CREATE TABLE IF NOT EXISTS records (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL,
  date           TEXT NOT NULL,                -- YYYY-MM-DD
  course_id      INTEGER NOT NULL,
  start_time     TEXT,                         -- HH:MM
  end_time       TEXT,                         -- HH:MM
  duration       INTEGER,                      -- 时长(分钟)
  status         TEXT NOT NULL DEFAULT 'attended', -- attended/leave/reschedule
  package_id     INTEGER,                      -- 扣减的课时包
  consumed_hours REAL DEFAULT 1,               -- 本节扣减课时
  fee            REAL,                          -- 本节实际花费（仅单节付费写入；课时包按平均单价折算，不存此列）
  note           TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (package_id) REFERENCES course_packages(id)
);
CREATE INDEX IF NOT EXISTS idx_records_user_date ON records(user_id, date);

-- 照片（元数据，文件存 R2）
CREATE TABLE IF NOT EXISTS photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id   INTEGER NOT NULL,
  r2_key      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (record_id) REFERENCES records(id)
);

-- 法定假日表（全局共享，供自动排课跳过假日用）
CREATE TABLE IF NOT EXISTS holidays (
  date        TEXT PRIMARY KEY,                -- YYYY-MM-DD
  name        TEXT,
  is_workday  INTEGER NOT NULL DEFAULT 0       -- 1=调休补班日
);

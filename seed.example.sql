-- 种子数据模板：默认登录用户
-- 用法：复制为 seed.sql，并把 password_hash 换成你自己的哈希
--   生成哈希：node scripts/gen-hash.mjs '你的密码'
-- 切勿把真实密码哈希提交到公开仓库。
INSERT OR IGNORE INTO users (id, username, password_hash, display_name)
VALUES (1, 'parent', 'PUT_YOUR_PBKDF2_HASH_HERE', '家长');

INSERT OR IGNORE INTO auth_identities (user_id, provider, provider_uid)
VALUES (1, 'password', 'parent');

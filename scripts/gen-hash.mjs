// 生成 PBKDF2 密码哈希，用于写入 seed.sql
// 用法：node scripts/gen-hash.mjs <密码>
import { hashPassword } from '../functions/utils/auth.js'

const pwd = process.argv[2] || '123456'
const hash = await hashPassword(pwd)
console.log(hash)

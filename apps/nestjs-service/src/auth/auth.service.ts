import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { RedisService } from '../redis/redis.service';
import { RedisKeys } from '../redis/redis.constants';

/** 解析 JWT_EXPIRES_IN 为秒，支持 7d / 1h / 3600 */
function parseTtlSeconds(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const m = raw.match(/^(\d+)([smhd])?$/);
  if (!m) return fallback;
  const n = Number(m[1]);
  switch (m[2]) {
    case 's':
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 3600;
    case 'd':
      return n * 86400;
    default:
      return n;
  }
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly userCacheTtl: number;

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {
    // TTL 与 JWT 过期时间对齐，默认 7 天
    this.userCacheTtl = parseTtlSeconds(process.env.JWT_EXPIRES_IN, 7 * 86400);
  }

  /** 将用户基础信息写入 Redis（不包含密码等敏感字段） */
  private async cacheUser(user: {
    id: number;
    email: string;
    username: string;
  }) {
    try {
      await this.redisService.setex(
        RedisKeys.user(user.id),
        this.userCacheTtl,
        JSON.stringify({
          id: user.id,
          email: user.email,
          username: user.username,
        }),
      );
    } catch (err) {
      this.logger.warn(
        `写入用户缓存失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async register(dto: RegisterDto) {
    // 检查邮箱是否已存在
    const existingUser = await this.userService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('邮箱已被注册');
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 创建用户
    const user = await this.userService.create({
      email: dto.email,
      username: dto.username,
      password: hashedPassword,
    });

    // 写入 Redis 缓存
    await this.cacheUser(user);

    // 签发 JWT
    const payload = { sub: user.id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async login(dto: LoginDto) {
    // 查找用户
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 写入 Redis 缓存
    await this.cacheUser(user);

    // 签发 JWT
    const payload = { sub: user.id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  /** 主动失效用户缓存（预留给登出/资料变更使用） */
  async invalidateUserCache(userId: number) {
    await this.redisService.del(RedisKeys.user(userId));
  }
}

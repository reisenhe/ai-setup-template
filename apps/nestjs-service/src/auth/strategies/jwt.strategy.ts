import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../../user/user.service';
import { RedisService } from '../../redis/redis.service';
import { RedisKeys } from '../../redis/redis.constants';
import { RequestContextService } from '../../common/request-context.service';

interface CachedUser {
  id: number;
  email: string;
  username: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private userService: UserService,
    private redisService: RedisService,
    private requestContext: RequestContextService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'default-secret',
    });
  }

  async validate(payload: { sub: number; email: string }) {
    this.requestContext.setUserId(payload.sub);

    // 1. 先查 Redis 缓存
    const key = RedisKeys.user(payload.sub);
    const cached = await this.redisService.get(key);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as CachedUser;
        return {
          id: parsed.id,
          email: parsed.email,
          username: parsed.username,
        };
      } catch {
        // 缓存格式异常，回源
        await this.redisService.del(key);
      }
    }

    // 2. 未命中 -> 回源 DB
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      return null;
    }

    // 3. 回写缓存（TTL 与 JWT 对齐，简化为固定 7 天；AuthService 会在登录时重新下发更精确的 TTL）
    const userInfo: CachedUser = {
      id: user.id,
      email: user.email,
      username: user.username,
    };
    await this.redisService.setex(
      key,
      60 * 60 * 24 * 7,
      JSON.stringify(userInfo),
    );

    return userInfo;
  }
}

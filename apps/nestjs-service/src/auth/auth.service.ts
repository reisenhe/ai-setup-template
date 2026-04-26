import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

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

    // 签发 JWT
    const payload = { sub: user.id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}

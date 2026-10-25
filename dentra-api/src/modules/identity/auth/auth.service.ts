import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { RequestOtpDto } from './dto/request-otp.dto';
import type { VerifyOtpDto } from './dto/verify-otp.dto';
import type { AdminLoginDto } from './dto/admin-login.dto';
import { OtpService } from './otp.service';
import { UsersService } from '../users/users.service';
import { TokensService, type AuthTokens } from './tokens.service';
import { verifyPassword } from '@common/utils/password.util';

// A real bcrypt hash that matches no real password — compared against
// on every login attempt for an email that doesn't resolve to an admin,
// so "no such admin" and "wrong password" take the same time and a
// caller can't use response latency to enumerate admin emails.
const DUMMY_PASSWORD_HASH = '$2b$12$qjZtyjgknmeCO4Iuu0MKde5oqaqbElscDqSCmmO9lblsdRpim/3uG';

@Injectable()
export class AuthService {
  constructor(
    private readonly otp: OtpService,
    private readonly users: UsersService,
    private readonly tokens: TokensService,
  ) {}

  async requestOtp(dto: RequestOtpDto) {
    const { mobile, purpose } = dto;

    await this.otp.assertNotRateLimited(mobile);
    const { otpId, code } = await this.otp.create(mobile, purpose);

    // TODO (Phase 6, pending SMS vendor): send `code` to `mobile` for real.
    // Logged instead of sent so the OTP flow is testable end to end now.
    // eslint-disable-next-line no-console
    console.log(`[otp:stub] ${mobile} (${purpose}) code=${code}`);

    return {
      otpId,
      expiresInSeconds: 300,
      resendAfterSeconds: 30,
      isNewAccount: await this.isUnregistered(mobile, purpose),
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthTokens> {
    const { mobile, purpose } = await this.otp.verifyAndConsume(dto.otpId, dto.code);

    const user = await this.users.findOrCreateByMobileAndRole(mobile, purpose);
    // An identity can exist before registration finishes; the role's profile decides "new".
    const isNewAccount = !(await this.users.hasProfile(user.id, purpose));
    return this.tokens.issue(user.id, user.role, dto.deviceId, isNewAccount);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    return this.tokens.rotate(refreshToken);
  }

  async logout(refreshToken: string): Promise<void> {
    return this.tokens.revoke(refreshToken);
  }

  async adminLogin(dto: AdminLoginDto): Promise<AuthTokens> {
    const admin = await this.users.findAdminByEmail(dto.email);

    const passwordOk = await verifyPassword(dto.password, admin?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!admin || admin.status !== 'active' || !passwordOk) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Browsers have separate session families. Keep the legacy slot for older clients.
    return this.tokens.issue(admin.id, 'admin', dto.deviceId ?? 'admin-web');
  }

  /** True until the matching profile exists — patients.register or dentists.applications, not just a users row. */
  private async isUnregistered(mobile: string, role: 'patient' | 'dentist'): Promise<boolean> {
    const existing = await this.users.findByMobileAndRole(mobile, role);
    if (!existing) return true;
    return !(await this.users.hasProfile(existing.id, role));
  }
}

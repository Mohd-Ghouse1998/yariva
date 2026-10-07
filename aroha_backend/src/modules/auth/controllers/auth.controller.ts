import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentSession } from "../../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import {
  LoginDto,
  RequestOtpDto,
  RefreshTokenDto,
  SignupDto,
  VerifyOtpDto,
  type AuthCapabilitiesDto,
  type AuthResponseDto,
  type RequestOtpResponseDto,
  type RefreshResponseDto,
} from "../dto/auth.dto";
import {
  LoginService,
  LogoutService,
  RefreshTokenService,
  SignupService,
} from "../application/auth.services";
import { OtpAuthService } from "../application/otp-auth.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly signupService: SignupService,
    private readonly loginService: LoginService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly logoutService: LogoutService,
    private readonly otpAuthService: OtpAuthService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get("capabilities")
  capabilities(): AuthCapabilitiesDto {
    return this.otpAuthService.capabilities();
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("otp/request")
  requestOtp(@Body() body: RequestOtpDto): Promise<RequestOtpResponseDto> {
    return this.otpAuthService.request(body);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("otp/verify")
  verifyOtp(
    @Body() body: VerifyOtpDto,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    return this.otpAuthService.verify(body, {
      ipAddress: request.ip ?? null,
      userAgent: request.get("user-agent") ?? null,
    });
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("signup")
  async signup(
    @Body() body: SignupDto,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    return this.signupService.execute(body, {
      ipAddress: request.ip ?? null,
      userAgent: request.get("user-agent") ?? null,
    });
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("login")
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    return this.loginService.execute(body, {
      ipAddress: request.ip ?? null,
      userAgent: request.get("user-agent") ?? null,
    });
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() request: Request,
  ): Promise<RefreshResponseDto> {
    return this.refreshTokenService.execute(body, {
      ipAddress: request.ip ?? null,
      userAgent: request.get("user-agent") ?? null,
    });
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("logout")
  async logout(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Req() request: Request,
  ): Promise<void> {
    await this.logoutService.execute(
      {
        user,
        session,
        tokenJti: "",
      },
      {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    );
  }
}

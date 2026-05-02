import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, CurrentUserData } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AdminOnlyGuard } from "../common/guards/admin-only.guard";
import { AuthService } from "../auth/auth.service";
import { AssignActivationCodeDto } from "./dto/assign-activation-code.dto";
import { ApproveUserDto } from "./dto/approve-user.dto";
import { DeleteUserDto } from "./dto/delete-user.dto";
import { AdminResetPasswordDto } from "../auth/dto/admin-reset-password.dto";
import { GenerateActivationCodesDto } from "./dto/generate-activation-codes.dto";
import { AdminService, ProfileStatusFilter } from "./admin.service";

@Controller("admin")
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
  ) {}

  @Get("dashboard")
  getDashboard(
    @Query("profileStatus") profileStatus?: ProfileStatusFilter,
    @Query("search") search?: string,
  ) {
    const normalized =
      profileStatus === "COMPLETO" || profileStatus === "INCOMPLETO"
        ? profileStatus
        : undefined;

    return this.adminService.getDashboard(normalized, search);
  }

  @Post("dashboard/assign-code")
  assignCode(@Body() dto: AssignActivationCodeDto) {
    return this.adminService.assignCodeAtomically(dto.userId, dto.code);
  }

  @Post("dashboard/generate-codes")
  generateCodes(@Body() dto: GenerateActivationCodesDto) {
    return this.adminService.generateActivationCodes(dto.quantity);
  }

  @Post("dashboard/approve-user")
  approveUser(@Body() dto: ApproveUserDto) {
    return this.adminService.approveUser(dto.userId);
  }

  @Post("dashboard/delete-user")
  deleteUser(@Body() dto: DeleteUserDto) {
    return this.adminService.deleteUserWithRelatedData(dto.userId);
  }

  @Post("dashboard/reset-password")
  createPasswordResetLink(@CurrentUser() user: CurrentUserData, @Body() dto: AdminResetPasswordDto) {
    return this.authService.createPasswordResetLink(user.id, dto);
  }
}

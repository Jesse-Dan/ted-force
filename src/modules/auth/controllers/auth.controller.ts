import { Autowired, Body, Controller, Get, Param, Post, Query } from "fragment-ts";
import { UseManagedRequestPipeline } from "../../../common/decorators/use-managed-request-pipeline.decorator";
import { UpsertUserAccountDto } from "../dto/upsert-user-account.dto";
import { AuthService } from "../services/auth.service";

@UseManagedRequestPipeline()
@Controller("/auth")
export class AuthController {
  @Autowired()
  private authService!: AuthService;

  @Get("/users/:userId")
  async getUser(@Param("userId") userId: string) {
    return this.authService.getUserById(userId);
  }

  @Get("/users/by-email/:email")
  async getUserByEmail(@Param("email") email: string) {
    return this.authService.getUserByEmail(email);
  }

  @Post("/users/upsert")
  async upsertUser(@Body() body: UpsertUserAccountDto) {
    return this.authService.upsertUser(body);
  }

  @Get("/role")
  async getRole(
    @Query("userId") userId: string,
    @Query("organizationId") organizationId: string,
  ) {
    return this.authService.getRole(userId, organizationId);
  }
}

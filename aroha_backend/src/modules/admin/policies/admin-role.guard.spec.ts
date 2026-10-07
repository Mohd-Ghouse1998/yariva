import type { ExecutionContext } from "@nestjs/common";
import { AdminRoleGuard } from "./admin-role.guard";

describe("AdminRoleGuard", () => {
  const guard = new AdminRoleGuard();

  it("allows admins", () => {
    expect(guard.canActivate(mockContext("ADMIN"))).toBe(true);
  });

  it("rejects regular users", () => {
    expect(() => guard.canActivate(mockContext("USER"))).toThrow(
      "Admin role is required",
    );
  });
});

function mockContext(role: "USER" | "MODERATOR" | "ADMIN"): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        auth: {
          user: { role },
        },
      }),
    }),
  } as unknown as ExecutionContext;
}


import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type CurrentUserData = {
  id: string;
  email?: string;
  isVerified?: boolean;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserData => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as CurrentUserData;
  },
);

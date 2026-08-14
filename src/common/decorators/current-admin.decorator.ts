import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AdminJwtPayload } from '../../auth/auth.service';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AdminJwtPayload | undefined =>
    context.switchToHttp().getRequest<Request>().user as
      AdminJwtPayload | undefined,
);

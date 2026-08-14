import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Protege todo lo administrativo. La autoridad real de la sesión vive aquí. */
@Injectable()
export class AdminGuard extends AuthGuard('admin-jwt') {}
